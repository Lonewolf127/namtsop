mod http;
mod storage;

use http::HttpState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Shared, pooled HTTP clients live for the whole app lifetime.
        .manage(HttpState::default())
        .invoke_handler(tauri::generate_handler![
            http::send_request,
            storage::list_projects,
            storage::save_project,
            storage::delete_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
