mod cli;
mod delete;
mod scan;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::delete::{delete_many, DeleteResult};
use crate::scan::{default_target_names, scan, ScanHit, ScanOptions};

#[tauri::command]
fn scan_paths(options: ScanOptions) -> Result<Vec<ScanHit>, String> {
    Ok(scan(&options))
}

#[tauri::command]
fn delete_paths(paths: Vec<String>) -> Vec<DeleteResult> {
    delete_many(&paths)
}

#[tauri::command]
fn get_default_targets() -> Vec<String> {
    default_target_names()
}

#[derive(Debug, Serialize, Deserialize)]
struct PathInfo {
    path: String,
    exists: bool,
    is_dir: bool,
}

#[tauri::command]
fn inspect_path(path: String) -> PathInfo {
    let p = PathBuf::from(&path);
    PathInfo {
        path,
        exists: p.exists(),
        is_dir: p.is_dir(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if cli::run_cli() {
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_paths,
            delete_paths,
            get_default_targets,
            inspect_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
