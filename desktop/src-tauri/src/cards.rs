use std::collections::BTreeSet;
use std::sync::Mutex;

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{Card, CardRelationship, CardType, SaveCardInput, SaveCardRelationshipInput};

const CARDS_MIGRATION: &str = include_str!("../migrations/000003_cards.sql");
const RELATIONSHIPS_MIGRATION: &str = include_str!("../migrations/000004_card_relationships.sql");

#[derive(Debug, Error)]
pub enum CardError {
    #[error("卡牌名稱不可空白")]
    EmptyName,
    #[error("卡牌資料格式無效")]
    InvalidDetails,
    #[error("設定狀態無效")]
    InvalidCanonStatus,
    #[error("關係類型不可空白，且兩端必須是不同卡牌")]
    InvalidRelationship,
    #[error("關係方向或狀態無效")]
    InvalidRelationshipState,
    #[error("找不到作品、卡牌或卡牌類型")]
    NotFound,
    #[error("資料庫操作失敗")]
    Database(#[from] rusqlite::Error),
}

pub struct CardRepository {
    connection: Mutex<Connection>,
}

impl CardRepository {
    pub fn open(path: &std::path::Path) -> Result<Self, CardError> {
        let mut connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version < 3 {
            let transaction = connection.transaction()?;
            transaction.execute_batch(CARDS_MIGRATION)?;
            transaction.pragma_update(None, "user_version", 3)?;
            transaction.commit()?;
        }
        if version < 4 {
            let transaction = connection.transaction()?;
            transaction.execute_batch(RELATIONSHIPS_MIGRATION)?;
            transaction.pragma_update(None, "user_version", 4)?;
            transaction.commit()?;
        }
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn list_types(&self, work_id: &str) -> Result<Vec<CardType>, CardError> {
        let connection = self.connection.lock().expect("card mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT id, name, icon, color, field_schema, is_builtin FROM card_types
             WHERE work_id IS NULL OR work_id = ?1 ORDER BY is_builtin DESC, name",
        )?;
        let rows = statement
            .query_map([work_id], |row| {
                let schema: String = row.get(4)?;
                Ok(CardType {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    color: row.get(3)?,
                    field_schema: serde_json::from_str(&schema).unwrap_or_default(),
                    is_builtin: row.get::<_, i64>(5)? != 0,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn list_cards(&self, work_id: &str) -> Result<Vec<Card>, CardError> {
        let connection = self.connection.lock().expect("card mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT c.id, c.work_id, c.type_id, t.name, c.name, c.canon_status, c.summary, c.details, c.tags, c.created_at, c.updated_at
             FROM cards c JOIN card_types t ON t.id = c.type_id
             WHERE c.work_id = ?1 AND c.deleted_at IS NULL ORDER BY c.sort_order, c.created_at",
        )?;
        let cards = statement
            .query_map([work_id], map_card)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(cards)
    }

    pub fn save_card(&self, input: SaveCardInput) -> Result<Card, CardError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(CardError::EmptyName);
        }
        if !input.details.is_object() {
            return Err(CardError::InvalidDetails);
        }
        if !matches!(
            input.canon_status.as_str(),
            "confirmed" | "tentative" | "deprecated"
        ) {
            return Err(CardError::InvalidCanonStatus);
        }
        let tags = input
            .tags
            .into_iter()
            .map(|tag| tag.trim().to_owned())
            .filter(|tag| !tag.is_empty())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let details =
            serde_json::to_string(&input.details).map_err(|_| CardError::InvalidDetails)?;
        let tags_json = serde_json::to_string(&tags).map_err(|_| CardError::InvalidDetails)?;
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let mut connection = self.connection.lock().expect("card mutex poisoned");
        let transaction = connection.transaction()?;
        let scope_exists: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM works w JOIN card_types t ON (t.work_id IS NULL OR t.work_id = w.id) WHERE w.id = ?1 AND t.id = ?2 AND w.deleted_at IS NULL)",
            params![input.work_id, input.type_id], |row| row.get(0),
        )?;
        if !scope_exists {
            return Err(CardError::NotFound);
        }
        let existing: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM cards WHERE id = ?1)",
            [&id],
            |row| row.get(0),
        )?;
        if existing {
            let changed = transaction.execute(
                "UPDATE cards SET type_id = ?1, name = ?2, canon_status = ?3, summary = ?4, details = ?5, tags = ?6, updated_at = ?7
                 WHERE id = ?8 AND work_id = ?9 AND deleted_at IS NULL",
                params![input.type_id, name, input.canon_status, input.summary, details, tags_json, now, id, input.work_id],
            )?;
            if changed == 0 {
                return Err(CardError::NotFound);
            }
        } else {
            let next_order: i64 = transaction.query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM cards WHERE work_id = ?1",
                [&input.work_id],
                |row| row.get(0),
            )?;
            transaction.execute(
                "INSERT INTO cards (id, work_id, type_id, name, canon_status, summary, details, tags, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
                params![id, input.work_id, input.type_id, name, input.canon_status, input.summary, details, tags_json, next_order, now],
            )?;
        }
        let card = transaction.query_row(
            "SELECT c.id, c.work_id, c.type_id, t.name, c.name, c.canon_status, c.summary, c.details, c.tags, c.created_at, c.updated_at FROM cards c JOIN card_types t ON t.id = c.type_id WHERE c.id = ?1",
            [&id], map_card,
        )?;
        transaction.commit()?;
        Ok(card)
    }

    pub fn delete_card(&self, work_id: &str, card_id: &str) -> Result<(), CardError> {
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let connection = self.connection.lock().expect("card mutex poisoned");
        let changed = connection.execute("UPDATE cards SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND work_id = ?3 AND deleted_at IS NULL", params![now, card_id, work_id])?;
        if changed == 0 {
            return Err(CardError::NotFound);
        }
        Ok(())
    }

    pub fn list_relationships(&self, work_id: &str) -> Result<Vec<CardRelationship>, CardError> {
        let connection = self.connection.lock().expect("card mutex poisoned");
        let mut statement = connection.prepare(
            "SELECT r.id, r.work_id, r.source_card_id, source.name, r.target_card_id, target.name,
                    r.relationship_type, r.description, r.direction, r.starts_at, r.ends_at,
                    r.status, r.is_secret, r.created_at, r.updated_at
             FROM card_relationships r
             JOIN cards source ON source.id = r.source_card_id
             JOIN cards target ON target.id = r.target_card_id
             WHERE r.work_id = ?1 AND r.deleted_at IS NULL
               AND source.deleted_at IS NULL AND target.deleted_at IS NULL
             ORDER BY r.created_at, r.id",
        )?;
        let relationships = statement
            .query_map([work_id], map_relationship)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(relationships)
    }

    pub fn save_relationship(
        &self,
        input: SaveCardRelationshipInput,
    ) -> Result<CardRelationship, CardError> {
        let relationship_type = input.relationship_type.trim();
        if relationship_type.is_empty() || input.source_card_id == input.target_card_id {
            return Err(CardError::InvalidRelationship);
        }
        if !matches!(
            input.direction.as_str(),
            "directed" | "bidirectional" | "undirected"
        ) || !matches!(
            input.status.as_str(),
            "active" | "planned" | "past" | "unknown"
        ) {
            return Err(CardError::InvalidRelationshipState);
        }
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let mut connection = self.connection.lock().expect("card mutex poisoned");
        let transaction = connection.transaction()?;
        let valid_endpoints: i64 = transaction.query_row(
            "SELECT COUNT(*) FROM cards WHERE work_id = ?1 AND id IN (?2, ?3) AND deleted_at IS NULL",
            params![input.work_id, input.source_card_id, input.target_card_id],
            |row| row.get(0),
        )?;
        if valid_endpoints != 2 {
            return Err(CardError::NotFound);
        }
        let existing: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM card_relationships WHERE id = ?1)",
            [&id],
            |row| row.get(0),
        )?;
        if existing {
            let changed = transaction.execute(
                "UPDATE card_relationships SET source_card_id = ?1, target_card_id = ?2,
                    relationship_type = ?3, description = ?4, direction = ?5, starts_at = ?6,
                    ends_at = ?7, status = ?8, is_secret = ?9, updated_at = ?10
                 WHERE id = ?11 AND work_id = ?12 AND deleted_at IS NULL",
                params![
                    input.source_card_id,
                    input.target_card_id,
                    relationship_type,
                    input.description.trim(),
                    input.direction,
                    input.starts_at,
                    input.ends_at,
                    input.status,
                    input.is_secret,
                    now,
                    id,
                    input.work_id
                ],
            )?;
            if changed == 0 {
                return Err(CardError::NotFound);
            }
        } else {
            transaction.execute(
                "INSERT INTO card_relationships
                    (id, work_id, source_card_id, target_card_id, relationship_type, description,
                     direction, starts_at, ends_at, status, is_secret, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
                params![
                    id,
                    input.work_id,
                    input.source_card_id,
                    input.target_card_id,
                    relationship_type,
                    input.description.trim(),
                    input.direction,
                    input.starts_at,
                    input.ends_at,
                    input.status,
                    input.is_secret,
                    now
                ],
            )?;
        }
        let relationship = transaction.query_row(
            "SELECT r.id, r.work_id, r.source_card_id, source.name, r.target_card_id, target.name,
                    r.relationship_type, r.description, r.direction, r.starts_at, r.ends_at,
                    r.status, r.is_secret, r.created_at, r.updated_at
             FROM card_relationships r JOIN cards source ON source.id = r.source_card_id
             JOIN cards target ON target.id = r.target_card_id WHERE r.id = ?1",
            [&id],
            map_relationship,
        )?;
        transaction.commit()?;
        Ok(relationship)
    }

    pub fn delete_relationship(
        &self,
        work_id: &str,
        relationship_id: &str,
    ) -> Result<(), CardError> {
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let connection = self.connection.lock().expect("card mutex poisoned");
        let changed = connection.execute(
            "UPDATE card_relationships SET deleted_at = ?1, updated_at = ?1
             WHERE id = ?2 AND work_id = ?3 AND deleted_at IS NULL",
            params![now, relationship_id, work_id],
        )?;
        if changed == 0 {
            return Err(CardError::NotFound);
        }
        Ok(())
    }
}

fn map_card(row: &rusqlite::Row<'_>) -> Result<Card, rusqlite::Error> {
    let details: String = row.get(7)?;
    let tags: String = row.get(8)?;
    Ok(Card {
        id: row.get(0)?,
        work_id: row.get(1)?,
        type_id: row.get(2)?,
        type_name: row.get(3)?,
        name: row.get(4)?,
        canon_status: row.get(5)?,
        summary: row.get(6)?,
        details: serde_json::from_str(&details).unwrap_or_default(),
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn map_relationship(row: &rusqlite::Row<'_>) -> Result<CardRelationship, rusqlite::Error> {
    Ok(CardRelationship {
        id: row.get(0)?,
        work_id: row.get(1)?,
        source_card_id: row.get(2)?,
        source_card_name: row.get(3)?,
        target_card_id: row.get(4)?,
        target_card_name: row.get(5)?,
        relationship_type: row.get(6)?,
        description: row.get(7)?,
        direction: row.get(8)?,
        starts_at: row.get(9)?,
        ends_at: row.get(10)?,
        status: row.get(11)?,
        is_secret: row.get::<_, i64>(12)? != 0,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::LibraryRepository;

    fn repositories() -> (tempfile::TempDir, LibraryRepository, CardRepository) {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("workspace.sqlite3");
        let library = LibraryRepository::open(&path).unwrap();
        let cards = CardRepository::open(&path).unwrap();
        (directory, library, cards)
    }

    #[test]
    fn character_requires_only_a_name_and_defaults_can_remain_empty() {
        let (_directory, library, cards) = repositories();
        let work = library.create_work(None).unwrap();
        let card = cards
            .save_card(SaveCardInput {
                id: None,
                work_id: work.id.clone(),
                type_id: "builtin-character".into(),
                name: " 林清越 ".into(),
                canon_status: "confirmed".into(),
                summary: String::new(),
                details: serde_json::json!({}),
                tags: vec![],
            })
            .unwrap();
        assert_eq!(card.name, "林清越");
        assert_eq!(cards.list_cards(&work.id).unwrap().len(), 1);
    }

    #[test]
    fn card_type_must_be_available_to_the_same_work() {
        let (_directory, library, cards) = repositories();
        let work = library.create_work(None).unwrap();
        let result = cards.save_card(SaveCardInput {
            id: None,
            work_id: work.id,
            type_id: "missing".into(),
            name: "角色".into(),
            canon_status: "confirmed".into(),
            summary: String::new(),
            details: serde_json::json!({}),
            tags: vec![],
        });
        assert!(matches!(result, Err(CardError::NotFound)));
    }

    #[test]
    fn relationship_requires_two_active_cards_in_the_same_work() {
        let (_directory, library, cards) = repositories();
        let work = library.create_work(None).unwrap();
        let other_work = library.create_work(Some("另一部作品")).unwrap();
        let source = cards
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
        let target = cards
            .save_card(SaveCardInput {
                id: None,
                work_id: work.id.clone(),
                type_id: "builtin-character".into(),
                name: "沈川".into(),
                canon_status: "confirmed".into(),
                summary: String::new(),
                details: serde_json::json!({}),
                tags: vec![],
            })
            .unwrap();
        let foreign = cards
            .save_card(SaveCardInput {
                id: None,
                work_id: other_work.id,
                type_id: "builtin-location".into(),
                name: "遠城".into(),
                canon_status: "confirmed".into(),
                summary: String::new(),
                details: serde_json::json!({}),
                tags: vec![],
            })
            .unwrap();

        let relationship = cards
            .save_relationship(SaveCardRelationshipInput {
                id: None,
                work_id: work.id.clone(),
                source_card_id: source.id.clone(),
                target_card_id: target.id,
                relationship_type: "師徒".into(),
                description: "彼此信任".into(),
                direction: "directed".into(),
                starts_at: None,
                ends_at: None,
                status: "active".into(),
                is_secret: false,
            })
            .unwrap();
        assert_eq!(relationship.source_card_name, "阿黎");
        assert_eq!(cards.list_relationships(&work.id).unwrap().len(), 1);

        let invalid = cards.save_relationship(SaveCardRelationshipInput {
            id: None,
            work_id: work.id,
            source_card_id: source.id,
            target_card_id: foreign.id,
            relationship_type: "知道".into(),
            description: String::new(),
            direction: "directed".into(),
            starts_at: None,
            ends_at: None,
            status: "unknown".into(),
            is_secret: true,
        });
        assert!(matches!(invalid, Err(CardError::NotFound)));
    }
}
