use serde::Serialize;

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
