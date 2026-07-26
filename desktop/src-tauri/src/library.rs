use std::sync::Mutex;

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde_json::json;
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{ChapterDocument, ChapterSummary, WorkSummary};

const INITIAL_MIGRATION: &str = include_str!("../migrations/000001_library.sql");

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
        let connection = Connection::open(path)?;
        Self::initialize(&connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    #[cfg(test)]
    fn in_memory() -> Result<Self, LibraryError> {
        let connection = Connection::open_in_memory()?;
        Self::initialize(&connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn initialize(connection: &Connection) -> Result<(), LibraryError> {
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version < 1 {
            connection.execute_batch(INITIAL_MIGRATION)?;
            connection.pragma_update(None, "user_version", 1)?;
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
        transaction.commit()?;
        Ok(ChapterDocument {
            chapter_id: chapter_id.to_owned(),
            schema_version: 1,
            text: text.to_owned(),
            saved_at: now,
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
}
