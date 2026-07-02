//! Project persistence.
//!
//! Each project (a "microservice" with its controllers/requests tree) is stored
//! as a single JSON file in the app data directory:
//!
//!   <app_data_dir>/projects/<project-id>.json
//!
//! The Rust side stays schema-agnostic (uses `serde_json::Value`) so the
//! frontend owns the project shape; this keeps the tree flexible as we add
//! environments and other fields later.

use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

/// Keep at most this many history entries per request.
const HISTORY_CAP: usize = 50;

/// Resolve (and create) the app data dir.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create data dir: {e}"))?;
    Ok(dir)
}

/// Resolve (and create) a named subdirectory under the app data dir.
fn subdir(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join(name);
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {name} dir: {e}"))?;
    Ok(dir)
}

fn projects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    subdir(app, "projects")
}

/// Write JSON to a temp file then rename, so a crash mid-write can't corrupt
/// an existing file.
fn atomic_write(dir: &PathBuf, name: &str, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    let tmp = dir.join(format!(".{name}.tmp"));
    let path = dir.join(name);
    fs::write(&tmp, text).map_err(|e| format!("write failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("commit failed: {e}"))?;
    Ok(())
}

/// Reject ids that could escape the projects directory.
fn safe_id(id: &str) -> Result<&str, String> {
    if id.is_empty()
        || id.contains('/')
        || id.contains('\\')
        || id.contains("..")
        || id.contains(':')
    {
        return Err(format!("invalid project id: {id}"));
    }
    Ok(id)
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<Value>, String> {
    let dir = projects_dir(&app)?;
    let mut projects = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<Value>(&text) {
                Ok(v) => projects.push(v),
                Err(e) => eprintln!("skipping malformed project {path:?}: {e}"),
            },
            Err(e) => eprintln!("could not read project {path:?}: {e}"),
        }
    }
    Ok(projects)
}

#[tauri::command]
pub fn save_project(app: AppHandle, project: Value) -> Result<(), String> {
    let id = project
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "project is missing a string `id`".to_string())?;
    let id = safe_id(id)?;

    let dir = projects_dir(&app)?;
    let path = dir.join(format!("{id}.json"));
    let text = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;

    // Write to a temp file then rename, so a crash mid-write can't corrupt an
    // existing project file.
    let tmp = dir.join(format!(".{id}.json.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("write failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("commit failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let id = safe_id(&id)?;
    let path = projects_dir(&app)?.join(format!("{id}.json"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("delete failed: {e}"))?;
    }
    Ok(())
}

// ---- app settings ----

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Value, String> {
    let path = data_dir(&app)?.join("settings.json");
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(_) => Ok(Value::Object(Default::default())), // no file yet → defaults
    }
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    atomic_write(&data_dir(&app)?, "settings.json", &settings)
}

// ---- per-request history ----

/// History lives in its own file per request id so it never loads with the
/// project and can be disabled/lazy-loaded independently.
#[tauri::command]
pub fn load_history(app: AppHandle, node_id: String) -> Result<Vec<Value>, String> {
    let id = safe_id(&node_id)?;
    let path = subdir(&app, "history")?.join(format!("{id}.json"));
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(_) => Ok(Vec::new()),
    }
}

/// Append one entry, keeping only the most recent HISTORY_CAP entries.
#[tauri::command]
pub fn append_history(
    app: AppHandle,
    node_id: String,
    entry: Value,
) -> Result<(), String> {
    let id = safe_id(&node_id)?;
    let dir = subdir(&app, "history")?;
    let path = dir.join(format!("{id}.json"));

    let mut entries: Vec<Value> = match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    entries.push(entry);
    let len = entries.len();
    if len > HISTORY_CAP {
        entries.drain(0..len - HISTORY_CAP);
    }
    atomic_write(&dir, &format!("{id}.json"), &Value::Array(entries))
}

#[tauri::command]
pub fn clear_history(app: AppHandle, node_id: String) -> Result<(), String> {
    let id = safe_id(&node_id)?;
    let path = subdir(&app, "history")?.join(format!("{id}.json"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("delete failed: {e}"))?;
    }
    Ok(())
}
