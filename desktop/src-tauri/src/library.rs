use std::sync::Mutex;

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde_json::json;
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{
    ChapterDocument, ChapterSummary, DocumentVersionSummary, RecoveryDraft, WorkSummary,
};

const INITIAL_MIGRATION: &str = include_str!("../migrations/000001_library.sql");
const DOCUMENT_SAFETY_MIGRATION: &str = include_str!("../migrations/000002_document_safety.sql");

#[derive(Debug, Error)]
pub enum LibraryError {
    #[error("資料庫操作失敗")]
    Database(#[from] rusqlite::Error),
    #[error("找不到章節")]
    ChapterNotFound,
}

pub struct LibraryRepository {
    connection: Mutex<Connection>,
}

impl LibraryRepository {
    pub fn open(path: &std::path::Path) -> Result<Self, LibraryError> {
        let mut connection = Connection::open(path)?;
        Self::initialize(&mut connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    #[cfg(test)]
    fn in_memory() -> Result<Self, LibraryError> {
        let mut connection = Connection::open_in_memory()?;
        Self::initialize(&mut connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn initialize(connection: &mut Connection) -> Result<(), LibraryError> {
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let mut version: i64 =
            connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version < 1 {
            let transaction = connection.transaction()?;
            transaction.execute_batch(INITIAL_MIGRATION)?;
            transaction.pragma_update(None, "user_version", 1)?;
            transaction.commit()?;
            version = 1;
        }
        if version < 2 {
            let transaction = connection.transaction()?;
            transaction.execute_batch(DOCUMENT_SAFETY_MIGRATION)?;
            transaction.pragma_update(None, "user_version", 2)?;
            transaction.commit()?;
        }
        Ok(())
    }

    pub fn list_works(&self) -> Result<Vec<WorkSummary>, LibraryError> {
        let connection = self.connection.lock().expect("library mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT id, title, status, updated_at FROM works WHERE deleted_at IS NULL ORDER BY updated_at DESC",
        )?;
        let works = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        works
            .into_iter()
            .map(|(id, title, status, updated_at)| {
                let chapters = Self::chapters_for(&connection, &id)?;
                Ok(WorkSummary {
                    id,
                    title,
                    status,
                    chapters,
                    updated_at,
                })
            })
            .collect()
    }

    pub fn create_work(&self, requested_title: Option<&str>) -> Result<WorkSummary, LibraryError> {
        let title = requested_title
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("未命名作品");
        let work_id = Uuid::new_v4().to_string();
        let chapter_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let content = json!({ "type": "doc", "schemaVersion": 1, "content": [{ "type": "paragraph", "content": [] }] }).to_string();
        let mut connection = self.connection.lock().expect("library mutex poisoned");
        let transaction = connection.transaction()?;
        transaction.execute("INSERT INTO works (id, title, status, created_at, updated_at) VALUES (?1, ?2, 'concept', ?3, ?3)", params![work_id, title, now])?;
        transaction.execute("INSERT INTO chapters (id, work_id, title, sort_order, created_at, updated_at) VALUES (?1, ?2, '第一章', 0, ?3, ?3)", params![chapter_id, work_id, now])?;
        transaction.execute("INSERT INTO documents (chapter_id, schema_version, content_json, plain_text, saved_at) VALUES (?1, 1, ?2, '', ?3)", params![chapter_id, content, now])?;
        transaction.commit()?;
        Ok(WorkSummary {
            id: work_id.clone(),
            title: title.to_owned(),
            status: "concept".into(),
            updated_at: now,
            chapters: vec![ChapterSummary {
                id: chapter_id,
                work_id,
                title: "第一章".into(),
                sort_order: 0,
                word_count: 0,
            }],
        })
    }

    pub fn load_chapter(&self, chapter_id: &str) -> Result<ChapterDocument, LibraryError> {
        let connection = self.connection.lock().expect("library mutex poisoned");
        connection
            .query_row(
                "SELECT schema_version, plain_text, saved_at FROM documents WHERE chapter_id = ?1",
                [chapter_id],
                |row| {
                    Ok(ChapterDocument {
                        chapter_id: chapter_id.to_owned(),
                        schema_version: row.get(0)?,
                        text: row.get(1)?,
                        saved_at: row.get(2)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => LibraryError::ChapterNotFound,
                other => LibraryError::Database(other),
            })
    }

    pub fn save_chapter(
        &self,
        chapter_id: &str,
        text: &str,
    ) -> Result<ChapterDocument, LibraryError> {
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let content = json!({ "type": "doc", "schemaVersion": 1, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": text }] }] }).to_string();
        let word_count = text
            .chars()
            .filter(|character| !character.is_whitespace())
            .count() as i64;
        let mut connection = self.connection.lock().expect("library mutex poisoned");
        let transaction = connection.transaction()?;
        let changed = transaction.execute(
            "UPDATE documents SET content_json = ?1, plain_text = ?2, saved_at = ?3 WHERE chapter_id = ?4",
            params![content, text, now, chapter_id],
        )?;
        if changed == 0 {
            return Err(LibraryError::ChapterNotFound);
        }
        transaction.execute(
            "UPDATE chapters SET word_count = ?1, updated_at = ?2 WHERE id = ?3",
            params![word_count, now, chapter_id],
        )?;
        transaction.execute("UPDATE works SET updated_at = ?1 WHERE id = (SELECT work_id FROM chapters WHERE id = ?2)", params![now, chapter_id])?;
        transaction.execute(
            "DELETE FROM recovery_journal WHERE chapter_id = ?1",
            [chapter_id],
        )?;
        transaction.commit()?;
        Ok(ChapterDocument {
            chapter_id: chapter_id.to_owned(),
            schema_version: 1,
            text: text.to_owned(),
            saved_at: now,
        })
    }

    pub fn write_recovery(
        &self,
        chapter_id: &str,
        text: &str,
    ) -> Result<RecoveryDraft, LibraryError> {
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let content = document_json(text);
        let connection = self.connection.lock().expect("library mutex poisoned");
        let exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM documents WHERE chapter_id = ?1)",
            [chapter_id],
            |row| row.get(0),
        )?;
        if !exists {
            return Err(LibraryError::ChapterNotFound);
        }
        connection.execute(
            "INSERT INTO recovery_journal (chapter_id, schema_version, content_json, plain_text, updated_at)
             VALUES (?1, 1, ?2, ?3, ?4)
             ON CONFLICT(chapter_id) DO UPDATE SET content_json = excluded.content_json, plain_text = excluded.plain_text, updated_at = excluded.updated_at",
            params![chapter_id, content, text, now],
        )?;
        Ok(RecoveryDraft {
            chapter_id: chapter_id.to_owned(),
            text: text.to_owned(),
            updated_at: now,
        })
    }

    pub fn load_recovery(&self, chapter_id: &str) -> Result<Option<RecoveryDraft>, LibraryError> {
        let connection = self.connection.lock().expect("library mutex poisoned");
        let result = connection.query_row(
            "SELECT plain_text, updated_at FROM recovery_journal WHERE chapter_id = ?1",
            [chapter_id],
            |row| {
                Ok(RecoveryDraft {
                    chapter_id: chapter_id.to_owned(),
                    text: row.get(0)?,
                    updated_at: row.get(1)?,
                })
            },
        );
        match result {
            Ok(draft) => Ok(Some(draft)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(LibraryError::Database(error)),
        }
    }

    pub fn clear_recovery(&self, chapter_id: &str) -> Result<(), LibraryError> {
        let connection = self.connection.lock().expect("library mutex poisoned");
        connection.execute(
            "DELETE FROM recovery_journal WHERE chapter_id = ?1",
            [chapter_id],
        )?;
        Ok(())
    }

    pub fn create_version(
        &self,
        chapter_id: &str,
        label: Option<&str>,
    ) -> Result<DocumentVersionSummary, LibraryError> {
        let connection = self.connection.lock().expect("library mutex poisoned");
        Self::snapshot_current(&connection, chapter_id, "manual", label, true)
    }

    pub fn list_versions(
        &self,
        chapter_id: &str,
    ) -> Result<Vec<DocumentVersionSummary>, LibraryError> {
        let connection = self.connection.lock().expect("library mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT id, reason, label, is_important, substr(plain_text, 1, 80), length(plain_text), created_at
             FROM document_versions WHERE chapter_id = ?1 ORDER BY created_at DESC",
        )?;
        let versions = statement
            .query_map([chapter_id], |row| {
                Ok(DocumentVersionSummary {
                    id: row.get(0)?,
                    chapter_id: chapter_id.to_owned(),
                    reason: row.get(1)?,
                    label: row.get(2)?,
                    is_important: row.get::<_, i64>(3)? != 0,
                    preview: row.get(4)?,
                    character_count: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(versions)
    }

    pub fn restore_version(&self, version_id: &str) -> Result<ChapterDocument, LibraryError> {
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let mut connection = self.connection.lock().expect("library mutex poisoned");
        let transaction = connection.transaction()?;
        let (chapter_id, schema_version, content_json, plain_text): (String, i64, String, String) = transaction
            .query_row(
                "SELECT chapter_id, schema_version, content_json, plain_text FROM document_versions WHERE id = ?1",
                [version_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|error| match error { rusqlite::Error::QueryReturnedNoRows => LibraryError::ChapterNotFound, other => LibraryError::Database(other) })?;
        Self::snapshot_current(
            &transaction,
            &chapter_id,
            "before_restore",
            Some("還原前自動版本"),
            false,
        )?;
        let word_count = count_characters(&plain_text);
        transaction.execute(
            "UPDATE documents SET schema_version = ?1, content_json = ?2, plain_text = ?3, saved_at = ?4 WHERE chapter_id = ?5",
            params![schema_version, content_json, plain_text, now, chapter_id],
        )?;
        transaction.execute(
            "UPDATE chapters SET word_count = ?1, updated_at = ?2 WHERE id = ?3",
            params![word_count, now, chapter_id],
        )?;
        transaction.execute(
            "DELETE FROM recovery_journal WHERE chapter_id = ?1",
            [&chapter_id],
        )?;
        transaction.commit()?;
        Ok(ChapterDocument {
            chapter_id,
            schema_version,
            text: plain_text,
            saved_at: now,
        })
    }

    fn snapshot_current(
        connection: &Connection,
        chapter_id: &str,
        reason: &str,
        label: Option<&str>,
        important: bool,
    ) -> Result<DocumentVersionSummary, LibraryError> {
        let (schema_version, content_json, plain_text): (i64, String, String) = connection
            .query_row("SELECT schema_version, content_json, plain_text FROM documents WHERE chapter_id = ?1", [chapter_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|error| match error { rusqlite::Error::QueryReturnedNoRows => LibraryError::ChapterNotFound, other => LibraryError::Database(other) })?;
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Nanos, true);
        connection.execute(
            "INSERT INTO document_versions (id, chapter_id, schema_version, content_json, plain_text, reason, label, is_important, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, chapter_id, schema_version, content_json, plain_text, reason, label, important as i64, created_at],
        )?;
        Ok(DocumentVersionSummary {
            id,
            chapter_id: chapter_id.to_owned(),
            reason: reason.to_owned(),
            label: label.map(str::to_owned),
            is_important: important,
            preview: plain_text.chars().take(80).collect(),
            character_count: plain_text.chars().count() as i64,
            created_at,
        })
    }

    fn chapters_for(
        connection: &Connection,
        work_id: &str,
    ) -> Result<Vec<ChapterSummary>, rusqlite::Error> {
        let mut statement = connection.prepare("SELECT id, title, sort_order, word_count FROM chapters WHERE work_id = ?1 AND deleted_at IS NULL ORDER BY sort_order")?;
        let chapters = statement
            .query_map([work_id], |row| {
                Ok(ChapterSummary {
                    id: row.get(0)?,
                    work_id: work_id.to_owned(),
                    title: row.get(1)?,
                    sort_order: row.get(2)?,
                    word_count: row.get(3)?,
                })
            })?
            .collect();
        chapters
    }
}

fn document_json(text: &str) -> String {
    json!({ "type": "doc", "schemaVersion": 1, "content": [{ "type": "paragraph", "content": if text.is_empty() { Vec::<serde_json::Value>::new() } else { vec![json!({ "type": "text", "text": text })] } }] }).to_string()
}

fn count_characters(text: &str) -> i64 {
    text.chars()
        .filter(|character| !character.is_whitespace())
        .count() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creating_a_work_atomically_creates_the_first_chapter_and_document() {
        let repository = LibraryRepository::in_memory().unwrap();
        let work = repository.create_work(Some("  青鳥  ")).unwrap();
        assert_eq!(work.title, "青鳥");
        assert_eq!(work.chapters.len(), 1);
        assert_eq!(work.chapters[0].title, "第一章");
        assert_eq!(
            repository.load_chapter(&work.chapters[0].id).unwrap().text,
            ""
        );
    }

    #[test]
    fn migrates_an_existing_v1_workspace_to_document_safety_schema() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(INITIAL_MIGRATION).unwrap();
        connection.pragma_update(None, "user_version", 1).unwrap();
        LibraryRepository::initialize(&mut connection).unwrap();
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        let table_exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'document_versions')",
            [], |row| row.get(0),
        ).unwrap();
        assert_eq!(version, 2);
        assert!(table_exists);
    }

    #[test]
    fn saving_updates_the_authoritative_document_projection() {
        let repository = LibraryRepository::in_memory().unwrap();
        let work = repository.create_work(None).unwrap();
        let chapter_id = &work.chapters[0].id;
        repository.save_chapter(chapter_id, "第一句。 ").unwrap();
        assert_eq!(
            repository.load_chapter(chapter_id).unwrap().text,
            "第一句。 "
        );
        assert_eq!(
            repository.list_works().unwrap()[0].chapters[0].word_count,
            4
        );
    }

    #[test]
    fn successful_save_clears_the_recovery_journal() {
        let repository = LibraryRepository::in_memory().unwrap();
        let work = repository.create_work(None).unwrap();
        let chapter_id = &work.chapters[0].id;
        repository
            .write_recovery(chapter_id, "尚未正式保存")
            .unwrap();
        assert_eq!(
            repository.load_recovery(chapter_id).unwrap().unwrap().text,
            "尚未正式保存"
        );
        repository.save_chapter(chapter_id, "已保存").unwrap();
        assert!(repository.load_recovery(chapter_id).unwrap().is_none());
    }

    #[test]
    fn restoring_a_version_preserves_the_pre_restore_content() {
        let repository = LibraryRepository::in_memory().unwrap();
        let work = repository.create_work(None).unwrap();
        let chapter_id = &work.chapters[0].id;
        repository.save_chapter(chapter_id, "第一版").unwrap();
        let first = repository.create_version(chapter_id, Some("初稿")).unwrap();
        repository
            .save_chapter(chapter_id, "第二版，不可遺失")
            .unwrap();

        let restored = repository.restore_version(&first.id).unwrap();
        assert_eq!(restored.text, "第一版");
        let versions = repository.list_versions(chapter_id).unwrap();
        assert!(versions
            .iter()
            .any(|version| version.reason == "before_restore"
                && version.preview == "第二版，不可遺失"));
        assert!(versions
            .iter()
            .any(|version| version.id == first.id && version.is_important));
    }
}
