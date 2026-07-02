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

/// Resolve (and create) the `projects/` directory under the app data dir.
fn projects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?
        .join("projects");
    fs::create_dir_all(&dir).map_err(|e| format!("could not create projects dir: {e}"))?;
    Ok(dir)
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
