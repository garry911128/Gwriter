mod domain;
mod library;

use domain::{ChapterDocument, DocumentVersionSummary, RecoveryDraft, WorkSummary};
use library::LibraryRepository;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let repository = LibraryRepository::open(&data_dir.join("workspace.sqlite3"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
            app.manage(repository);
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
            restore_version
        ])
        .run(tauri::generate_context!())
        .expect("GWriter failed to start");
}
