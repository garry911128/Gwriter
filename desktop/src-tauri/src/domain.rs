use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterSummary {
    pub id: String,
    pub work_id: String,
    pub title: String,
    pub sort_order: i64,
    pub word_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub chapters: Vec<ChapterSummary>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterDocument {
    pub chapter_id: String,
    pub schema_version: i64,
    pub text: String,
    pub saved_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVersionSummary {
    pub id: String,
    pub chapter_id: String,
    pub reason: String,
    pub label: Option<String>,
    pub is_important: bool,
    pub preview: String,
    pub character_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDraft {
    pub chapter_id: String,
    pub text: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardType {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub field_schema: serde_json::Value,
    pub is_builtin: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub work_id: String,
    pub type_id: String,
    pub type_name: String,
    pub name: String,
    pub canon_status: String,
    pub summary: String,
    pub details: serde_json::Value,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCardInput {
    pub id: Option<String>,
    pub work_id: String,
    pub type_id: String,
    pub name: String,
    pub canon_status: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default = "empty_object")]
    pub details: serde_json::Value,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardRelationship {
    pub id: String,
    pub work_id: String,
    pub source_card_id: String,
    pub source_card_name: String,
    pub target_card_id: String,
    pub target_card_name: String,
    pub relationship_type: String,
    pub description: String,
    pub direction: String,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub status: String,
    pub is_secret: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCardRelationshipInput {
    pub id: Option<String>,
    pub work_id: String,
    pub source_card_id: String,
    pub target_card_id: String,
    pub relationship_type: String,
    #[serde(default)]
    pub description: String,
    pub direction: String,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub status: String,
    #[serde(default)]
    pub is_secret: bool,
}

fn empty_object() -> serde_json::Value {
    serde_json::json!({})
}
