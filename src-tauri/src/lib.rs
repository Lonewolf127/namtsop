mod http;
mod storage;

use http::HttpState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Shared, pooled HTTP clients live for the whole app lifetime.
        .manage(HttpState::default())
        .invoke_handler(tauri::generate_handler![
            http::send_request,
            storage::list_projects,
            storage::save_project,
            storage::delete_project,
            storage::load_settings,
            storage::save_settings,
            storage::load_history,
            storage::append_history,
            storage::clear_history,
            storage::load_scratch,
            storage::save_scratch,
            storage::read_text_file,
            storage::write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
