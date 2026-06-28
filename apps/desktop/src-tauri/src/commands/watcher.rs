use notify::{event::ModifyKind, Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use crate::sync::state::SyncCommand;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultFileChanged {
    pub path: String,
    pub kind: String,
    pub watcher_id: String,
}

struct WatcherState {
    watchers: HashMap<String, RecommendedWatcher>,
    next_id: u64,
}

pub fn init(app: &tauri::App) {
    app.manage(Mutex::new(WatcherState {
        watchers: HashMap::new(),
        next_id: 1,
    }));
}

fn event_kind_to_string(kind: &EventKind) -> Option<&'static str> {
    match kind {
        EventKind::Create(_) => Some("created"),
        EventKind::Modify(ModifyKind::Name(_)) => Some("renamed"),
        EventKind::Modify(_) => Some("modified"),
        EventKind::Remove(_) => Some("deleted"),
        _ => None,
    }
}

#[tauri::command]
pub fn start_watching(
    app: AppHandle,
    path: String,
    include_hidden: Option<bool>,
    follow_symlinks: Option<bool>,
) -> Result<String, String> {
    let state = app.state::<Mutex<WatcherState>>();
    let watcher_id = {
        let mut state = state.lock().map_err(|e| e.to_string())?;
        let watcher_id = format!("watcher-{}", state.next_id);
        state.next_id += 1;
        watcher_id
    };

    let app_handle = app.clone();
    let sync_tx = app.try_state::<tokio::sync::mpsc::Sender<SyncCommand>>();
    let sync_sender = sync_tx.map(|s| (*s).clone());
    let vault_path = path.clone();
    let include_hidden = include_hidden.unwrap_or(false);
    let follow_symlinks = follow_symlinks.unwrap_or(false);
    let event_watcher_id = watcher_id.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                if let Some(kind_str) = event_kind_to_string(&event.kind) {
                    for path in &event.paths {
                        let path_str = path.to_string_lossy().to_string();
                        let filename = path_str.rsplit('/').next().unwrap_or(&path_str);
                        if matches!(filename, ".DS_Store" | "Thumbs.db" | "desktop.ini") {
                            continue;
                        }

                        if !include_hidden && is_hidden_path(Path::new(&path_str)) {
                            continue;
                        }

                        let _ = app_handle.emit(
                            "vault-file-changed",
                            VaultFileChanged {
                                path: path_str.clone(),
                                kind: kind_str.to_string(),
                                watcher_id: event_watcher_id.clone(),
                            },
                        );

                        if !include_hidden {
                            if let Some(ref sender) = sync_sender {
                                let cmd = if kind_str == "deleted" {
                                    SyncCommand::LocalFileDeleted { path: path_str }
                                } else {
                                    SyncCommand::LocalFileChanged { path: path_str }
                                };
                                let _ = sender.try_send(cmd);
                            }
                        }
                    }
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    add_watch_paths(&mut watcher, Path::new(&vault_path), follow_symlinks)?;

    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.watchers.insert(watcher_id.clone(), watcher);
    Ok(watcher_id)
}

#[tauri::command]
pub fn stop_watching(app: AppHandle, watcher_id: String) -> Result<(), String> {
    let state = app.state::<Mutex<WatcherState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.watchers.remove(&watcher_id);
    Ok(())
}

fn add_watch_paths(
    watcher: &mut RecommendedWatcher,
    root: &Path,
    follow_symlinks: bool,
) -> Result<(), String> {
    watcher
        .watch(root, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    if follow_symlinks {
        add_symlink_targets(watcher, root)?;
    }

    Ok(())
}

fn add_symlink_targets(watcher: &mut RecommendedWatcher, dir: &Path) -> Result<(), String> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if file_type.is_symlink() {
            let target = match fs::canonicalize(&entry_path) {
                Ok(target) => target,
                Err(_) => continue,
            };
            if target.is_dir() {
                watcher
                    .watch(&target, RecursiveMode::Recursive)
                    .map_err(|e| e.to_string())?;
            }
            continue;
        }

        if file_type.is_dir() {
            add_symlink_targets(watcher, &entry_path)?;
        }
    }

    Ok(())
}

fn is_hidden_path(path: &Path) -> bool {
    path.components()
        .any(|component| component.as_os_str().to_string_lossy().starts_with('.'))
}
