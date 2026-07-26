mod backup;
mod cards;
mod domain;
mod graphs;
mod library;
mod outline;

use backup::BackupService;
use cards::CardRepository;
use domain::{
    Card, CardRelationship, CardType, ChapterDocument, DocumentVersionSummary, LocalBackupInfo,
    OutlineNode, RecoveryDraft, RelationshipGraph, RelationshipGraphNode, SaveCardInput,
    SaveCardRelationshipInput, SaveOutlineNodeInput, SaveRelationshipGraphInput,
    SaveRelationshipGraphNodeInput, WorkSummary, WorkspaceStorageInfo,
};
use graphs::GraphRepository;
use library::LibraryRepository;
use outline::OutlineRepository;
use tauri::Manager;

#[tauri::command]
fn list_works(repository: tauri::State<'_, LibraryRepository>) -> Result<Vec<WorkSummary>, String> {
    repository.list_works().map_err(|error| error.to_string())
}

#[tauri::command]
fn create_work(
    title: Option<String>,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<WorkSummary, String> {
    repository
        .create_work(title.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_chapter(
    chapter_id: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<ChapterDocument, String> {
    repository
        .load_chapter(&chapter_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_chapter(
    chapter_id: String,
    text: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<ChapterDocument, String> {
    repository
        .save_chapter(&chapter_id, &text)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn write_recovery(
    chapter_id: String,
    text: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<RecoveryDraft, String> {
    repository
        .write_recovery(&chapter_id, &text)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_recovery(
    chapter_id: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<Option<RecoveryDraft>, String> {
    repository
        .load_recovery(&chapter_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_recovery(
    chapter_id: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<(), String> {
    repository
        .clear_recovery(&chapter_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_version(
    chapter_id: String,
    label: Option<String>,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<DocumentVersionSummary, String> {
    repository
        .create_version(&chapter_id, label.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_versions(
    chapter_id: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<Vec<DocumentVersionSummary>, String> {
    repository
        .list_versions(&chapter_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn restore_version(
    version_id: String,
    repository: tauri::State<'_, LibraryRepository>,
) -> Result<ChapterDocument, String> {
    repository
        .restore_version(&version_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_card_types(
    work_id: String,
    repository: tauri::State<'_, CardRepository>,
) -> Result<Vec<CardType>, String> {
    repository
        .list_types(&work_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_cards(
    work_id: String,
    repository: tauri::State<'_, CardRepository>,
) -> Result<Vec<Card>, String> {
    repository
        .list_cards(&work_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_card(
    input: SaveCardInput,
    repository: tauri::State<'_, CardRepository>,
) -> Result<Card, String> {
    repository
        .save_card(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_card(
    work_id: String,
    card_id: String,
    repository: tauri::State<'_, CardRepository>,
) -> Result<(), String> {
    repository
        .delete_card(&work_id, &card_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_card_relationships(
    work_id: String,
    repository: tauri::State<'_, CardRepository>,
) -> Result<Vec<CardRelationship>, String> {
    repository
        .list_relationships(&work_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_card_relationship(
    input: SaveCardRelationshipInput,
    repository: tauri::State<'_, CardRepository>,
) -> Result<CardRelationship, String> {
    repository
        .save_relationship(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_card_relationship(
    work_id: String,
    relationship_id: String,
    repository: tauri::State<'_, CardRepository>,
) -> Result<(), String> {
    repository
        .delete_relationship(&work_id, &relationship_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_relationship_graphs(
    work_id: String,
    repository: tauri::State<'_, GraphRepository>,
) -> Result<Vec<RelationshipGraph>, String> {
    repository
        .list_graphs(&work_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_relationship_graph(
    input: SaveRelationshipGraphInput,
    repository: tauri::State<'_, GraphRepository>,
) -> Result<RelationshipGraph, String> {
    repository
        .save_graph(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_relationship_graph_nodes(
    work_id: String,
    graph_id: String,
    repository: tauri::State<'_, GraphRepository>,
) -> Result<Vec<RelationshipGraphNode>, String> {
    repository
        .list_nodes(&work_id, &graph_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_relationship_graph_node(
    input: SaveRelationshipGraphNodeInput,
    repository: tauri::State<'_, GraphRepository>,
) -> Result<RelationshipGraphNode, String> {
    repository
        .save_node(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_relationship_graph_node(
    work_id: String,
    graph_id: String,
    card_id: String,
    repository: tauri::State<'_, GraphRepository>,
) -> Result<(), String> {
    repository
        .remove_node(&work_id, &graph_id, &card_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_outline_nodes(
    work_id: String,
    repository: tauri::State<'_, OutlineRepository>,
) -> Result<Vec<OutlineNode>, String> {
    repository
        .list_nodes(&work_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_outline_node(
    input: SaveOutlineNodeInput,
    repository: tauri::State<'_, OutlineRepository>,
) -> Result<OutlineNode, String> {
    repository
        .save_node(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn convert_outline_node_to_chapter(
    work_id: String,
    node_id: String,
    repository: tauri::State<'_, OutlineRepository>,
) -> Result<OutlineNode, String> {
    repository
        .convert_to_chapter(&work_id, &node_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_workspace_storage_info(service: tauri::State<'_, BackupService>) -> WorkspaceStorageInfo {
    service.storage_info()
}
#[tauri::command]
fn create_local_backup(
    service: tauri::State<'_, BackupService>,
) -> Result<LocalBackupInfo, String> {
    service.create_backup().map_err(|error| error.to_string())
}
#[tauri::command]
fn list_local_backups(
    service: tauri::State<'_, BackupService>,
) -> Result<Vec<LocalBackupInfo>, String> {
    service.list_backups().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let repository = LibraryRepository::open(&data_dir.join("workspace.sqlite3"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
            let card_repository = CardRepository::open(&data_dir.join("workspace.sqlite3"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
            let graph_repository = GraphRepository::open(&data_dir.join("workspace.sqlite3"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
            let outline_repository = OutlineRepository::open(&data_dir.join("workspace.sqlite3"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
            let backup_service = BackupService::new(data_dir);
            let _ = backup_service.ensure_daily_backup();
            app.manage(repository);
            app.manage(card_repository);
            app.manage(graph_repository);
            app.manage(outline_repository);
            app.manage(backup_service);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_works,
            create_work,
            load_chapter,
            save_chapter,
            write_recovery,
            load_recovery,
            clear_recovery,
            create_version,
            list_versions,
            restore_version,
            list_card_types,
            list_cards,
            save_card,
            delete_card,
            list_card_relationships,
            save_card_relationship,
            delete_card_relationship,
            list_relationship_graphs,
            save_relationship_graph,
            list_relationship_graph_nodes,
            save_relationship_graph_node,
            remove_relationship_graph_node,
            list_outline_nodes,
            save_outline_node,
            convert_outline_node_to_chapter,
            get_workspace_storage_info,
            create_local_backup,
            list_local_backups
        ])
        .run(tauri::generate_context!())
        .expect("GWriter failed to start");
}
