use crate::domain::{LocalBackupInfo, PortableBackupInfo, WorkspaceStorageInfo};
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::{Connection, DatabaseName};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use thiserror::Error;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

const BACKUP_FORMAT_VERSION: i64 = 1;

#[derive(Debug, Error)]
pub enum BackupError {
    #[error("無法建立或讀取備份檔案")]
    Io(#[from] std::io::Error),
    #[error("無法產生一致的 SQLite 備份")]
    Database(#[from] rusqlite::Error),
    #[error("備份完整性檢查失敗")]
    Integrity,
    #[error("無法建立可攜備份包")]
    Archive(#[from] zip::result::ZipError),
    #[error("備份 manifest 無法序列化")]
    Manifest(#[from] serde_json::Error),
}

pub struct BackupService {
    data_directory: PathBuf,
    database_path: PathBuf,
    backup_directory: PathBuf,
}

#[derive(Serialize)]
struct PortableManifest<'a> {
    format: &'a str,
    format_version: i64,
    created_at: &'a str,
    app_version: &'a str,
    schema_version: i64,
    database_path: &'a str,
    database_sha256: &'a str,
    assets: Vec<String>,
}
impl BackupService {
    pub fn new(data_directory: PathBuf) -> Self {
        let database_path = data_directory.join("workspace.sqlite3");
        let backup_directory = data_directory.join("backups");
        Self {
            data_directory,
            database_path,
            backup_directory,
        }
    }
    pub fn storage_info(&self) -> WorkspaceStorageInfo {
        WorkspaceStorageInfo {
            data_directory: self.data_directory.display().to_string(),
            database_path: self.database_path.display().to_string(),
            backup_directory: self.backup_directory.display().to_string(),
        }
    }
    pub fn create_backup(&self) -> Result<LocalBackupInfo, BackupError> {
        fs::create_dir_all(&self.backup_directory)?;
        let created = Utc::now();
        let file_name = format!(
            "gwriter-safety-v{BACKUP_FORMAT_VERSION}-{}.sqlite3",
            created.format("%Y%m%dT%H%M%S%.3fZ")
        );
        let destination = self.backup_directory.join(&file_name);
        let source = Connection::open(&self.database_path)?;
        source.backup(DatabaseName::Main, &destination, None)?;
        let check = Connection::open(&destination)?
            .query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))?;
        if check != "ok" {
            let _ = fs::remove_file(&destination);
            return Err(BackupError::Integrity);
        }
        self.cleanup_expired()?;
        self.info_for(&destination, created)
    }
    pub fn ensure_daily_backup(&self) -> Result<Option<LocalBackupInfo>, BackupError> {
        let recent = self.list_backups()?.into_iter().any(|backup| {
            DateTime::parse_from_rfc3339(&backup.created_at)
                .map(|time| {
                    Utc::now().signed_duration_since(time.with_timezone(&Utc)) < Duration::hours(24)
                })
                .unwrap_or(false)
        });
        if recent {
            Ok(None)
        } else {
            self.create_backup().map(Some)
        }
    }
    pub fn export_portable_backup(
        &self,
        destination: &Path,
    ) -> Result<PortableBackupInfo, BackupError> {
        let parent = destination.parent().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "missing destination directory",
            )
        })?;
        fs::create_dir_all(parent)?;
        let token = uuid::Uuid::new_v4();
        let snapshot_path = self
            .backup_directory
            .join(format!("export-{token}.sqlite3"));
        fs::create_dir_all(&self.backup_directory)?;
        let source = Connection::open(&self.database_path)?;
        source.backup(DatabaseName::Main, &snapshot_path, None)?;
        let snapshot = Connection::open(&snapshot_path)?;
        let check: String = snapshot.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
        let schema_version: i64 =
            snapshot.pragma_query_value(None, "user_version", |row| row.get(0))?;
        drop(snapshot);
        if check != "ok" {
            let _ = fs::remove_file(&snapshot_path);
            return Err(BackupError::Integrity);
        }
        let database_bytes = fs::read(&snapshot_path)?;
        let database_sha256 = Sha256::digest(&database_bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let manifest = PortableManifest {
            format: "gwriter-workspace-backup",
            format_version: BACKUP_FORMAT_VERSION,
            created_at: &created_at,
            app_version: env!("CARGO_PKG_VERSION"),
            schema_version,
            database_path: "workspace/workspace.sqlite3",
            database_sha256: &database_sha256,
            assets: vec![],
        };
        let partial = parent.join(format!(".gwriter-export-{token}.partial"));
        let result = (|| -> Result<(), BackupError> {
            let file = fs::File::create(&partial)?;
            let mut archive = ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
            archive.start_file("manifest.json", options)?;
            std::io::Write::write_all(&mut archive, &serde_json::to_vec_pretty(&manifest)?)?;
            archive.start_file("workspace/workspace.sqlite3", options)?;
            std::io::Write::write_all(&mut archive, &database_bytes)?;
            archive.finish()?;
            if destination.exists() {
                fs::remove_file(destination)?;
            }
            fs::rename(&partial, destination)?;
            Ok(())
        })();
        let _ = fs::remove_file(&snapshot_path);
        if result.is_err() {
            let _ = fs::remove_file(&partial);
        }
        result?;
        Ok(PortableBackupInfo {
            path: destination.display().to_string(),
            size_bytes: fs::metadata(destination)?.len(),
            created_at,
            format_version: BACKUP_FORMAT_VERSION,
            database_sha256,
        })
    }
    pub fn list_backups(&self) -> Result<Vec<LocalBackupInfo>, BackupError> {
        if !self.backup_directory.exists() {
            return Ok(vec![]);
        }
        let mut items = vec![];
        for entry in fs::read_dir(&self.backup_directory)? {
            let path = entry?.path();
            if path.extension().and_then(|value| value.to_str()) == Some("sqlite3")
                && path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .is_some_and(|name| name.starts_with("gwriter-safety-v1-"))
            {
                let modified = fs::metadata(&path)?.modified()?.into();
                items.push(self.info_for(&path, modified)?);
            }
        }
        items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(items)
    }
    fn cleanup_expired(&self) -> Result<(), BackupError> {
        let cutoff = Utc::now() - Duration::days(30);
        for backup in self.list_backups()? {
            if DateTime::parse_from_rfc3339(&backup.created_at)
                .map(|time| time.with_timezone(&Utc) < cutoff)
                .unwrap_or(false)
            {
                fs::remove_file(backup.path)?;
            }
        }
        Ok(())
    }
    fn info_for(
        &self,
        path: &Path,
        created: DateTime<Utc>,
    ) -> Result<LocalBackupInfo, BackupError> {
        Ok(LocalBackupInfo {
            file_name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            path: path.display().to_string(),
            size_bytes: fs::metadata(path)?.len(),
            created_at: created.to_rfc3339_opts(SecondsFormat::Millis, true),
            format_version: BACKUP_FORMAT_VERSION,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    #[test]
    fn creates_a_consistent_versioned_local_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let db = directory.path().join("workspace.sqlite3");
        let connection = Connection::open(&db).unwrap();
        connection
            .execute_batch("CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('稿件');")
            .unwrap();
        drop(connection);
        let service = BackupService::new(directory.path().to_path_buf());
        let backup = service.create_backup().unwrap();
        assert_eq!(backup.format_version, 1);
        let copied = Connection::open(backup.path).unwrap();
        assert_eq!(
            copied
                .query_row("SELECT value FROM sample", [], |row| row
                    .get::<_, String>(0))
                .unwrap(),
            "稿件"
        );
        assert!(service.ensure_daily_backup().unwrap().is_none());
    }

    #[test]
    fn portable_package_contains_a_versioned_manifest_and_verified_database() {
        let directory = tempfile::tempdir().unwrap();
        let db = directory.path().join("workspace.sqlite3");
        let connection = Connection::open(&db).unwrap();
        connection.execute_batch("PRAGMA user_version=6; CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('正文');").unwrap();
        drop(connection);
        let service = BackupService::new(directory.path().to_path_buf());
        let destination = directory.path().join("author.gwriter-backup");
        let result = service.export_portable_backup(&destination).unwrap();
        assert_eq!(result.database_sha256.len(), 64);
        let mut archive = zip::ZipArchive::new(fs::File::open(destination).unwrap()).unwrap();
        let mut manifest = String::new();
        archive
            .by_name("manifest.json")
            .unwrap()
            .read_to_string(&mut manifest)
            .unwrap();
        let manifest: serde_json::Value = serde_json::from_str(&manifest).unwrap();
        assert_eq!(manifest["format_version"], 1);
        assert_eq!(manifest["schema_version"], 6);
        assert_eq!(manifest["database_sha256"], result.database_sha256);
        assert!(archive.by_name("workspace/workspace.sqlite3").is_ok());
    }
}
