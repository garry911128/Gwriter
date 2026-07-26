use std::sync::Mutex;

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{
    RelationshipGraph, RelationshipGraphNode, SaveRelationshipGraphInput,
    SaveRelationshipGraphNodeInput,
};

const GRAPHS_MIGRATION: &str = include_str!("../migrations/000005_relationship_graphs.sql");

#[derive(Debug, Error)]
pub enum GraphError {
    #[error("關係圖名稱不可空白")]
    EmptyName,
    #[error("找不到作品、關係圖或卡牌")]
    NotFound,
    #[error("畫布位置必須是有限數值")]
    InvalidPosition,
    #[error("關係圖資料庫操作失敗")]
    Database(#[from] rusqlite::Error),
}

pub struct GraphRepository {
    connection: Mutex<Connection>,
}

impl GraphRepository {
    pub fn open(path: &std::path::Path) -> Result<Self, GraphError> {
        let mut connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version < 5 {
            let transaction = connection.transaction()?;
            transaction.execute_batch(GRAPHS_MIGRATION)?;
            transaction.pragma_update(None, "user_version", 5)?;
            transaction.commit()?;
        }
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn list_graphs(&self, work_id: &str) -> Result<Vec<RelationshipGraph>, GraphError> {
        let connection = self.connection.lock().expect("graph mutex poisoned");
        let mut statement = connection.prepare("SELECT id, work_id, name, description, created_at, updated_at FROM relationship_graphs WHERE work_id = ?1 AND deleted_at IS NULL ORDER BY created_at, id")?;
        let graphs = statement
            .query_map([work_id], map_graph)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(graphs)
    }

    pub fn save_graph(
        &self,
        input: SaveRelationshipGraphInput,
    ) -> Result<RelationshipGraph, GraphError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(GraphError::EmptyName);
        }
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let mut connection = self.connection.lock().expect("graph mutex poisoned");
        let transaction = connection.transaction()?;
        let work_exists: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM works WHERE id = ?1 AND deleted_at IS NULL)",
            [&input.work_id],
            |row| row.get(0),
        )?;
        if !work_exists {
            return Err(GraphError::NotFound);
        }
        let existing: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM relationship_graphs WHERE id = ?1)",
            [&id],
            |row| row.get(0),
        )?;
        if existing {
            let changed = transaction.execute("UPDATE relationship_graphs SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4 AND work_id = ?5 AND deleted_at IS NULL", params![name, input.description.trim(), now, id, input.work_id])?;
            if changed == 0 {
                return Err(GraphError::NotFound);
            }
        } else {
            transaction.execute("INSERT INTO relationship_graphs (id, work_id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)", params![id, input.work_id, name, input.description.trim(), now])?;
        }
        let graph = transaction.query_row("SELECT id, work_id, name, description, created_at, updated_at FROM relationship_graphs WHERE id = ?1", [&id], map_graph)?;
        transaction.commit()?;
        Ok(graph)
    }

    pub fn list_nodes(
        &self,
        work_id: &str,
        graph_id: &str,
    ) -> Result<Vec<RelationshipGraphNode>, GraphError> {
        let connection = self.connection.lock().expect("graph mutex poisoned");
        let mut statement = connection.prepare("SELECT n.graph_id, n.card_id, c.name, t.name, t.color, n.position_x, n.position_y FROM relationship_graph_nodes n JOIN relationship_graphs g ON g.id = n.graph_id JOIN cards c ON c.id = n.card_id JOIN card_types t ON t.id = c.type_id WHERE n.graph_id = ?1 AND g.work_id = ?2 AND g.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY n.created_at, n.card_id")?;
        let nodes = statement
            .query_map(params![graph_id, work_id], map_node)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(nodes)
    }

    pub fn save_node(
        &self,
        input: SaveRelationshipGraphNodeInput,
    ) -> Result<RelationshipGraphNode, GraphError> {
        if !input.position_x.is_finite() || !input.position_y.is_finite() {
            return Err(GraphError::InvalidPosition);
        }
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let connection = self.connection.lock().expect("graph mutex poisoned");
        let valid: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM relationship_graphs g JOIN cards c ON c.work_id = g.work_id WHERE g.id = ?1 AND g.work_id = ?2 AND c.id = ?3 AND g.deleted_at IS NULL AND c.deleted_at IS NULL)", params![input.graph_id, input.work_id, input.card_id], |row| row.get(0))?;
        if !valid {
            return Err(GraphError::NotFound);
        }
        connection.execute("INSERT INTO relationship_graph_nodes (graph_id, card_id, position_x, position_y, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5) ON CONFLICT(graph_id, card_id) DO UPDATE SET position_x = excluded.position_x, position_y = excluded.position_y, updated_at = excluded.updated_at", params![input.graph_id, input.card_id, input.position_x, input.position_y, now])?;
        Ok(connection.query_row("SELECT n.graph_id, n.card_id, c.name, t.name, t.color, n.position_x, n.position_y FROM relationship_graph_nodes n JOIN cards c ON c.id = n.card_id JOIN card_types t ON t.id = c.type_id WHERE n.graph_id = ?1 AND n.card_id = ?2", params![input.graph_id, input.card_id], map_node)?)
    }

    pub fn remove_node(
        &self,
        work_id: &str,
        graph_id: &str,
        card_id: &str,
    ) -> Result<(), GraphError> {
        let connection = self.connection.lock().expect("graph mutex poisoned");
        let changed = connection.execute("DELETE FROM relationship_graph_nodes WHERE graph_id = ?1 AND card_id = ?2 AND EXISTS(SELECT 1 FROM relationship_graphs WHERE id = ?1 AND work_id = ?3 AND deleted_at IS NULL)", params![graph_id, card_id, work_id])?;
        if changed == 0 {
            return Err(GraphError::NotFound);
        }
        Ok(())
    }
}

fn map_graph(row: &rusqlite::Row<'_>) -> Result<RelationshipGraph, rusqlite::Error> {
    Ok(RelationshipGraph {
        id: row.get(0)?,
        work_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}
fn map_node(row: &rusqlite::Row<'_>) -> Result<RelationshipGraphNode, rusqlite::Error> {
    Ok(RelationshipGraphNode {
        graph_id: row.get(0)?,
        card_id: row.get(1)?,
        card_name: row.get(2)?,
        type_name: row.get(3)?,
        color: row.get(4)?,
        position_x: row.get(5)?,
        position_y: row.get(6)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{cards::CardRepository, domain::SaveCardInput, library::LibraryRepository};

    #[test]
    fn one_card_can_have_independent_positions_in_multiple_graphs() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("workspace.sqlite3");
        let library = LibraryRepository::open(&path).unwrap();
        let cards = CardRepository::open(&path).unwrap();
        let graphs = GraphRepository::open(&path).unwrap();
        let work = library.create_work(None).unwrap();
        let card = cards
            .save_card(SaveCardInput {
                id: None,
                work_id: work.id.clone(),
                type_id: "builtin-character".into(),
                name: "阿黎".into(),
                canon_status: "confirmed".into(),
                summary: String::new(),
                details: serde_json::json!({}),
                tags: vec![],
            })
            .unwrap();
        let first = graphs
            .save_graph(SaveRelationshipGraphInput {
                id: None,
                work_id: work.id.clone(),
                name: "人物關係".into(),
                description: String::new(),
            })
            .unwrap();
        let second = graphs
            .save_graph(SaveRelationshipGraphInput {
                id: None,
                work_id: work.id.clone(),
                name: "勢力關係".into(),
                description: String::new(),
            })
            .unwrap();
        graphs
            .save_node(SaveRelationshipGraphNodeInput {
                work_id: work.id.clone(),
                graph_id: first.id.clone(),
                card_id: card.id.clone(),
                position_x: 20.0,
                position_y: 40.0,
            })
            .unwrap();
        graphs
            .save_node(SaveRelationshipGraphNodeInput {
                work_id: work.id.clone(),
                graph_id: second.id.clone(),
                card_id: card.id,
                position_x: 300.0,
                position_y: 120.0,
            })
            .unwrap();
        assert_eq!(
            graphs.list_nodes(&work.id, &first.id).unwrap()[0].position_x,
            20.0
        );
        assert_eq!(
            graphs.list_nodes(&work.id, &second.id).unwrap()[0].position_x,
            300.0
        );
    }
}
