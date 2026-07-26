use crate::domain::{OutlineNode, SaveOutlineNodeInput};
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde_json::json;
use std::sync::Mutex;
use thiserror::Error;
use uuid::Uuid;

const OUTLINE_MIGRATION: &str = include_str!("../migrations/000006_outline_nodes.sql");

#[derive(Debug, Error)]
pub enum OutlineError {
    #[error("大綱節點標題不可空白")]
    EmptyTitle,
    #[error("大綱節點類型或狀態無效")]
    InvalidState,
    #[error("找不到作品、父節點或大綱節點")]
    NotFound,
    #[error("大綱資料庫操作失敗")]
    Database(#[from] rusqlite::Error),
}

pub struct OutlineRepository {
    connection: Mutex<Connection>,
}
impl OutlineRepository {
    pub fn open(path: &std::path::Path) -> Result<Self, OutlineError> {
        let mut connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version < 6 {
            let transaction = connection.transaction()?;
            transaction.execute_batch(OUTLINE_MIGRATION)?;
            transaction.pragma_update(None, "user_version", 6)?;
            transaction.commit()?;
        }
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn list_nodes(&self, work_id: &str) -> Result<Vec<OutlineNode>, OutlineError> {
        let connection = self.connection.lock().expect("outline mutex poisoned");
        let mut statement = connection.prepare("SELECT id, work_id, parent_id, node_type, title, summary, purpose, conflict, outcome, status, notes, bound_entity_kind, bound_entity_id, sort_order, created_at, updated_at FROM outline_nodes WHERE work_id = ?1 AND deleted_at IS NULL ORDER BY parent_id, sort_order, created_at")?;
        let nodes = statement
            .query_map([work_id], map_node)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(nodes)
    }

    pub fn save_node(&self, input: SaveOutlineNodeInput) -> Result<OutlineNode, OutlineError> {
        let title = input.title.trim();
        if title.is_empty() {
            return Err(OutlineError::EmptyTitle);
        }
        if !matches!(
            input.node_type.as_str(),
            "planning" | "volume" | "chapter" | "scene"
        ) || !matches!(
            input.status.as_str(),
            "idea" | "planned" | "drafting" | "revising" | "done"
        ) {
            return Err(OutlineError::InvalidState);
        }
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        if input.parent_id.as_deref() == Some(id.as_str()) {
            return Err(OutlineError::InvalidState);
        }
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let mut connection = self.connection.lock().expect("outline mutex poisoned");
        let transaction = connection.transaction()?;
        let work_exists: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM works WHERE id = ?1 AND deleted_at IS NULL)",
            [&input.work_id],
            |row| row.get(0),
        )?;
        let parent_exists = match &input.parent_id { Some(parent_id) => transaction.query_row("SELECT EXISTS(SELECT 1 FROM outline_nodes WHERE id = ?1 AND work_id = ?2 AND deleted_at IS NULL)", params![parent_id, input.work_id], |row| row.get(0))?, None => true };
        if !work_exists || !parent_exists {
            return Err(OutlineError::NotFound);
        }
        let existing: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM outline_nodes WHERE id = ?1)",
            [&id],
            |row| row.get(0),
        )?;
        if existing {
            let changed = transaction.execute("UPDATE outline_nodes SET parent_id=?1,node_type=?2,title=?3,summary=?4,purpose=?5,conflict=?6,outcome=?7,status=?8,notes=?9,updated_at=?10 WHERE id=?11 AND work_id=?12 AND deleted_at IS NULL", params![input.parent_id,input.node_type,title,input.summary.trim(),input.purpose.trim(),input.conflict.trim(),input.outcome.trim(),input.status,input.notes.trim(),now,id,input.work_id])?;
            if changed == 0 {
                return Err(OutlineError::NotFound);
            }
        } else {
            let next_order: i64 = transaction.query_row("SELECT COALESCE(MAX(sort_order),-1)+1 FROM outline_nodes WHERE work_id=?1 AND parent_id IS ?2", params![input.work_id,input.parent_id], |row| row.get(0))?;
            transaction.execute("INSERT INTO outline_nodes (id,work_id,parent_id,node_type,title,summary,purpose,conflict,outcome,status,notes,sort_order,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)", params![id,input.work_id,input.parent_id,input.node_type,title,input.summary.trim(),input.purpose.trim(),input.conflict.trim(),input.outcome.trim(),input.status,input.notes.trim(),next_order,now])?;
        }
        let node = transaction.query_row("SELECT id, work_id, parent_id, node_type, title, summary, purpose, conflict, outcome, status, notes, bound_entity_kind, bound_entity_id, sort_order, created_at, updated_at FROM outline_nodes WHERE id=?1", [&id], map_node)?;
        transaction.commit()?;
        Ok(node)
    }

    pub fn convert_to_chapter(
        &self,
        work_id: &str,
        node_id: &str,
    ) -> Result<OutlineNode, OutlineError> {
        let chapter_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let content =
            json!({"type":"doc","schemaVersion":1,"content":[{"type":"paragraph","content":[]}]})
                .to_string();
        let mut connection = self.connection.lock().expect("outline mutex poisoned");
        let transaction = connection.transaction()?;
        let (title, bound_id, node_type): (String, Option<String>, String) = transaction.query_row("SELECT title,bound_entity_id,node_type FROM outline_nodes WHERE id=?1 AND work_id=?2 AND deleted_at IS NULL", params![node_id,work_id], |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?))).map_err(|error| match error { rusqlite::Error::QueryReturnedNoRows => OutlineError::NotFound, other => OutlineError::Database(other) })?;
        if bound_id.is_some() || node_type == "volume" {
            return Err(OutlineError::InvalidState);
        }
        let next_order: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(sort_order),-1)+1 FROM chapters WHERE work_id=?1",
            [work_id],
            |row| row.get(0),
        )?;
        transaction.execute("INSERT INTO chapters (id,work_id,title,sort_order,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?5)", params![chapter_id,work_id,title,next_order,now])?;
        transaction.execute("INSERT INTO documents (chapter_id,schema_version,content_json,plain_text,saved_at) VALUES (?1,1,?2,'',?3)", params![chapter_id,content,now])?;
        transaction.execute("UPDATE outline_nodes SET node_type='chapter',bound_entity_kind='chapter',bound_entity_id=?1,updated_at=?2 WHERE id=?3", params![chapter_id,now,node_id])?;
        transaction.execute(
            "UPDATE works SET updated_at=?1 WHERE id=?2",
            params![now, work_id],
        )?;
        let node = transaction.query_row("SELECT id, work_id, parent_id, node_type, title, summary, purpose, conflict, outcome, status, notes, bound_entity_kind, bound_entity_id, sort_order, created_at, updated_at FROM outline_nodes WHERE id=?1", [node_id], map_node)?;
        transaction.commit()?;
        Ok(node)
    }
}

fn map_node(row: &rusqlite::Row<'_>) -> Result<OutlineNode, rusqlite::Error> {
    Ok(OutlineNode {
        id: row.get(0)?,
        work_id: row.get(1)?,
        parent_id: row.get(2)?,
        node_type: row.get(3)?,
        title: row.get(4)?,
        summary: row.get(5)?,
        purpose: row.get(6)?,
        conflict: row.get(7)?,
        outcome: row.get(8)?,
        status: row.get(9)?,
        notes: row.get(10)?,
        bound_entity_kind: row.get(11)?,
        bound_entity_id: row.get(12)?,
        sort_order: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::LibraryRepository;
    #[test]
    fn planning_node_can_exist_without_a_bound_document() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("workspace.sqlite3");
        let library = LibraryRepository::open(&path).unwrap();
        crate::cards::CardRepository::open(&path).unwrap();
        crate::graphs::GraphRepository::open(&path).unwrap();
        let outlines = OutlineRepository::open(&path).unwrap();
        let work = library.create_work(None).unwrap();
        let node = outlines
            .save_node(SaveOutlineNodeInput {
                id: None,
                work_id: work.id.clone(),
                parent_id: None,
                node_type: "planning".into(),
                title: "主角發現密室".into(),
                summary: String::new(),
                purpose: "揭露線索".into(),
                conflict: String::new(),
                outcome: String::new(),
                status: "idea".into(),
                notes: String::new(),
            })
            .unwrap();
        assert!(node.bound_entity_id.is_none());
        assert_eq!(outlines.list_nodes(&work.id).unwrap().len(), 1);
    }

    #[test]
    fn conversion_atomically_creates_a_chapter_and_binds_the_node() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("workspace.sqlite3");
        let library = LibraryRepository::open(&path).unwrap();
        crate::cards::CardRepository::open(&path).unwrap();
        crate::graphs::GraphRepository::open(&path).unwrap();
        let outlines = OutlineRepository::open(&path).unwrap();
        let work = library.create_work(None).unwrap();
        let node = outlines
            .save_node(SaveOutlineNodeInput {
                id: None,
                work_id: work.id.clone(),
                parent_id: None,
                node_type: "planning".into(),
                title: "密室".into(),
                summary: String::new(),
                purpose: String::new(),
                conflict: String::new(),
                outcome: String::new(),
                status: "planned".into(),
                notes: String::new(),
            })
            .unwrap();
        let bound = outlines.convert_to_chapter(&work.id, &node.id).unwrap();
        assert_eq!(bound.bound_entity_kind.as_deref(), Some("chapter"));
        let refreshed = library.list_works().unwrap();
        assert_eq!(refreshed[0].chapters.len(), 2);
        assert_eq!(refreshed[0].chapters[1].title, "密室");
    }
}
