mod domain;
mod library;

use domain::{ChapterDocument, WorkSummary};
use library::LibraryRepository;
use tauri::Manager;

#[tauri::command]
fn list_works(repository: tauri::State<'_, LibraryRepository>) -> Result<Vec<WorkSummary>, String> {
    repository.list_works().map_err(|error| error.to_string())
}

#[tauri::command]
fn create_work(title: Option<String>, repository: tauri::State<'_, LibraryRepository>) -> Result<WorkSummary, String> {
    repository.create_work(title.as_deref()).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_chapter(chapter_id: String, repository: tauri::State<'_, LibraryRepository>) -> Result<ChapterDocument, String> {
    repository.load_chapter(&chapter_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_chapter(chapter_id: String, text: String, repository: tauri::State<'_, LibraryRepository>) -> Result<ChapterDocument, String> {
    repository.save_chapter(&chapter_id, &text).map_err(|error| error.to_string())
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
        .invoke_handler(tauri::generate_handler![list_works, create_work, load_chapter, save_chapter])
        .run(tauri::generate_context!())
        .expect("GWriter failed to start");
}
