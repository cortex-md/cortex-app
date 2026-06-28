use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::atomic_fs::atomic_write_bytes;
use crate::sync::crypto;
use crate::sync::db::{NoteSyncMetadata, SyncDb, SyncState};
use crate::sync::http::SyncHttpClient;
use crate::sync::ignore::{should_ignore, SyncPreferences};
use crate::sync::paths::normalize_relative_path;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InitialSyncProgress {
    pub total: usize,
    pub completed: usize,
    pub phase: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct RemoteFileInfo {
    file_path: String,
    checksum: Option<String>,
    version: Option<u64>,
    #[allow(dead_code)]
    snapshot_id: Option<String>,
    deleted: Option<bool>,
    #[allow(dead_code)]
    size_bytes: Option<u64>,
    updated_at: Option<String>,
    created_at: Option<String>,
    last_modified_by: Option<String>,
    last_device_id: Option<String>,
}

#[derive(Debug, PartialEq)]
enum InitialSyncAction {
    Download {
        path: String,
        #[allow(dead_code)]
        version: u64,
    },
    Upload {
        path: String,
    },
    Conflict {
        path: String,
    },
    Delete {
        path: String,
    },
}

pub struct InitialSync<'a> {
    app: &'a AppHandle,
    client: &'a SyncHttpClient,
    db: &'a SyncDb,
    vault_id: &'a str,
    vault_path: &'a str,
    vek: &'a [u8; 32],
    sync_preferences: &'a SyncPreferences,
}

impl<'a> InitialSync<'a> {
    pub fn new(
        app: &'a AppHandle,
        client: &'a SyncHttpClient,
        db: &'a SyncDb,
        vault_id: &'a str,
        vault_path: &'a str,
        vek: &'a [u8; 32],
        sync_preferences: &'a SyncPreferences,
    ) -> Self {
        Self {
            app,
            client,
            db,
            vault_id,
            vault_path,
            vek,
            sync_preferences,
        }
    }

    pub async fn run(&self) -> Result<(), String> {
        self.emit_progress(0, 0, "listing");

        let remote_files = self.fetch_remote_file_list().await?;
        for remote in &remote_files {
            self.db.upsert_note_metadata(
                &remote.file_path,
                &NoteSyncMetadata {
                    created_at: remote.created_at.clone(),
                    created_by: (remote.version == Some(1))
                        .then(|| remote.last_modified_by.clone())
                        .flatten(),
                    last_edited_at: remote.updated_at.clone(),
                    last_edited_by: remote.last_modified_by.clone(),
                    last_device_id: remote.last_device_id.clone(),
                    synced: true,
                    creation_lookup_complete: remote.version == Some(1),
                },
            )?;
        }
        let local_states = self.db.list_all_sync_states()?;
        let local_disk_files = self.scan_local_files()?;

        let actions = Self::compute_actions(
            &remote_files,
            &local_states,
            &local_disk_files,
            self.sync_preferences,
        );
        let total = actions.len();

        self.emit_progress(total, 0, "syncing");

        let mut completed = 0;
        let mut batch = Vec::new();
        let mut first_error = None;

        for action in &actions {
            batch.push(action);

            if batch.len() >= 3 || batch.len() + completed >= total {
                for queued_action in &batch {
                    match queued_action {
                        InitialSyncAction::Download { path, version: _ } => {
                            self.emit_file_event(path, "downloading");
                            match self.download_file(path).await {
                                Ok(()) => {
                                    self.emit_log("info", &format!("Pulled: {}", path));
                                    self.emit_file_event(path, "synced");
                                }
                                Err(e) => {
                                    self.emit_log(
                                        "error",
                                        &format!("Pull failed: {} — {}", path, e),
                                    );
                                    self.emit_file_event(path, &format!("error: {}", e));
                                    first_error.get_or_insert(e);
                                }
                            }
                        }
                        InitialSyncAction::Upload { path } => {
                            self.emit_file_event(path, "uploading");
                            match self.upload_file(path).await {
                                Ok(()) => {
                                    self.emit_log("info", &format!("Pushed: {}", path));
                                    self.emit_file_event(path, "synced");
                                }
                                Err(e) => {
                                    self.emit_log(
                                        "error",
                                        &format!("Push failed: {} — {}", path, e),
                                    );
                                    self.emit_file_event(path, &format!("error: {}", e));
                                    first_error.get_or_insert(e);
                                }
                            }
                        }
                        InitialSyncAction::Conflict { path } => {
                            self.mark_conflict(path)?;
                        }
                        InitialSyncAction::Delete { path } => {
                            let full_path = Path::new(self.vault_path).join(path);
                            if full_path.exists() {
                                std::fs::remove_file(&full_path)
                                    .map_err(|error| error.to_string())?;
                            }
                            self.db.delete_sync_state(path)?;
                            self.emit_file_event(path, "deleted");
                        }
                    }
                    completed += 1;
                    self.emit_progress(total, completed, "syncing");
                }
                batch.clear();
            }
        }

        if let Some(error) = first_error {
            return Err(error);
        }
        self.emit_progress(total, total, "complete");
        let _ = self.app.emit("sync-initial-complete", ());

        Ok(())
    }

    async fn fetch_remote_file_list(&self) -> Result<Vec<RemoteFileInfo>, String> {
        let api_path = format!("/sync/v1/vaults/{}/files/list", self.vault_id);
        let response = self.client.get(&api_path).await?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Failed to list remote files: {}", body));
        }

        let files: Vec<RemoteFileInfo> = response.json().await.map_err(|e| e.to_string())?;
        Ok(files)
    }

    fn scan_local_files(&self) -> Result<HashMap<String, LocalFileInfo>, String> {
        let mut files = HashMap::new();
        self.walk_dir(Path::new(self.vault_path), &mut files)?;
        Ok(files)
    }

    fn walk_dir(
        &self,
        dir: &Path,
        files: &mut HashMap<String, LocalFileInfo>,
    ) -> Result<(), String> {
        let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            let relative = path
                .strip_prefix(self.vault_path)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            let relative = normalize_relative_path(&relative);

            if should_ignore(&relative, self.sync_preferences) {
                continue;
            }

            if path.is_dir() {
                self.walk_dir(&path, files)?;
            } else {
                let content = std::fs::read(&path).map_err(|e| e.to_string())?;
                let hash = blake3::hash(&content).to_hex().to_string();
                let mtime = std::fs::metadata(&path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64);

                files.insert(
                    relative,
                    LocalFileInfo {
                        hash,
                        mtime,
                        size: content.len() as u64,
                    },
                );
            }
        }
        Ok(())
    }

    fn compute_actions(
        remote_files: &[RemoteFileInfo],
        local_states: &[SyncState],
        local_disk: &HashMap<String, LocalFileInfo>,
        sync_preferences: &SyncPreferences,
    ) -> Vec<InitialSyncAction> {
        let mut actions = Vec::new();

        let state_map: HashMap<&str, &SyncState> = local_states
            .iter()
            .map(|s| (s.file_path.as_str(), s))
            .collect();

        let remote_map: HashMap<&str, &RemoteFileInfo> = remote_files
            .iter()
            .map(|f| (f.file_path.as_str(), f))
            .collect();

        for remote in remote_files {
            if remote.deleted.unwrap_or(false) {
                if local_disk.contains_key(&remote.file_path) {
                    if state_map.contains_key(remote.file_path.as_str()) {
                        actions.push(InitialSyncAction::Delete {
                            path: remote.file_path.clone(),
                        });
                    } else {
                        actions.push(InitialSyncAction::Upload {
                            path: remote.file_path.clone(),
                        });
                    }
                }
                continue;
            }
            if should_ignore(&remote.file_path, sync_preferences) {
                continue;
            }

            let has_local = local_disk.contains_key(&remote.file_path);
            let db_state = state_map.get(remote.file_path.as_str());

            if !has_local {
                actions.push(InitialSyncAction::Download {
                    path: remote.file_path.clone(),
                    version: remote.version.unwrap_or(1),
                });
            } else if let Some(local) = local_disk.get(&remote.file_path) {
                let remote_checksum = remote.checksum.as_deref().unwrap_or("");
                if local.hash != remote_checksum {
                    if let Some(state) = db_state {
                        let ancestor = state.ancestor_hash.as_deref();
                        let local_changed = ancestor.map_or(true, |a| a != local.hash);
                        let remote_changed = ancestor.map_or(true, |a| a != remote_checksum);

                        if local_changed && remote_changed {
                            actions.push(InitialSyncAction::Conflict {
                                path: remote.file_path.clone(),
                            });
                        } else if remote_changed {
                            actions.push(InitialSyncAction::Download {
                                path: remote.file_path.clone(),
                                version: remote.version.unwrap_or(1),
                            });
                        } else {
                            actions.push(InitialSyncAction::Upload {
                                path: remote.file_path.clone(),
                            });
                        }
                    } else {
                        actions.push(InitialSyncAction::Download {
                            path: remote.file_path.clone(),
                            version: remote.version.unwrap_or(1),
                        });
                    }
                }
            }
        }

        for (path, _local_info) in local_disk {
            if !remote_map.contains_key(path.as_str()) && !should_ignore(path, sync_preferences) {
                actions.push(InitialSyncAction::Upload { path: path.clone() });
            }
        }

        actions.sort_by(|a, b| {
            let priority_a = match a {
                InitialSyncAction::Download { .. } => 0,
                InitialSyncAction::Conflict { .. } => 1,
                InitialSyncAction::Delete { .. } => 2,
                InitialSyncAction::Upload { .. } => 3,
            };
            let priority_b = match b {
                InitialSyncAction::Download { .. } => 0,
                InitialSyncAction::Conflict { .. } => 1,
                InitialSyncAction::Delete { .. } => 2,
                InitialSyncAction::Upload { .. } => 3,
            };
            priority_a.cmp(&priority_b)
        });

        actions
    }

    async fn download_file(&self, file_path: &str) -> Result<(), String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files?path={}",
            self.vault_id,
            urlencoded(file_path)
        );

        let response = self.client.get(&api_path).await?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Download failed: {}", body));
        }

        let snapshot_id = response
            .headers()
            .get("X-Snapshot-ID")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let _version_str = response
            .headers()
            .get("X-File-Version")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let encrypted = response.bytes().await.map_err(|e| e.to_string())?;
        let plaintext = crypto::decrypt(&encrypted, self.vek)?;
        let remote_hash = blake3::hash(&plaintext).to_hex().to_string();

        let full_path = Path::new(self.vault_path).join(file_path);
        atomic_write_bytes(&full_path, &plaintext)?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.db.upsert_sync_state(&SyncState {
            file_path: file_path.to_string(),
            local_hash: Some(remote_hash.clone()),
            remote_hash: Some(remote_hash.clone()),
            ancestor_hash: Some(remote_hash),
            local_mtime: Some(now),
            remote_mtime: Some(now),
            sync_status: "synced".to_string(),
            last_synced_at: Some(now),
            server_version_id: snapshot_id,
        })?;

        Ok(())
    }

    async fn upload_file(&self, file_path: &str) -> Result<(), String> {
        let full_path = Path::new(self.vault_path).join(file_path);
        let content = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let local_hash = blake3::hash(&content).to_hex().to_string();

        let encrypted = crypto::encrypt(&content, self.vek)?;
        let api_path = format!("/sync/v1/vaults/{}/files", self.vault_id);

        let headers = vec![
            ("X-File-Path".to_string(), file_path.to_string()),
            ("X-Local-Hash".to_string(), local_hash.clone()),
            (
                "Content-Type".to_string(),
                "application/octet-stream".to_string(),
            ),
        ];

        let response = self
            .client
            .post_bytes(&api_path, encrypted, headers)
            .await?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Upload failed: {}", body));
        }

        let response_body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let snapshot_id = response_body["snapshot_id"].as_str().map(|s| s.to_string());
        self.db.upsert_note_metadata(
            file_path,
            &NoteSyncMetadata {
                created_at: response_body["created_at"].as_str().map(String::from),
                created_by: (response_body["version"].as_u64() == Some(1))
                    .then(|| response_body["last_modified_by"].as_str().map(String::from))
                    .flatten(),
                last_edited_at: response_body["updated_at"].as_str().map(String::from),
                last_edited_by: response_body["last_modified_by"].as_str().map(String::from),
                last_device_id: response_body["last_device_id"].as_str().map(String::from),
                synced: true,
                creation_lookup_complete: response_body["version"].as_u64() == Some(1),
            },
        )?;

        let mtime = std::fs::metadata(&full_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        self.db.upsert_sync_state(&SyncState {
            file_path: file_path.to_string(),
            local_hash: Some(local_hash.clone()),
            remote_hash: Some(local_hash.clone()),
            ancestor_hash: Some(local_hash),
            local_mtime: mtime,
            remote_mtime: mtime,
            sync_status: "synced".to_string(),
            last_synced_at: Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64,
            ),
            server_version_id: snapshot_id,
        })?;

        Ok(())
    }

    fn mark_conflict(&self, file_path: &str) -> Result<(), String> {
        if let Some(mut state) = self.db.get_sync_state(file_path)? {
            state.sync_status = "conflict".to_string();
            self.db.upsert_sync_state(&state)?;
        }

        let _ = self
            .app
            .emit("sync-conflict", serde_json::json!({ "path": file_path }));

        Ok(())
    }

    fn emit_file_event(&self, path: &str, status: &str) {
        let _ = self.app.emit(
            "sync-file-event",
            serde_json::json!({ "path": path, "status": status }),
        );
    }

    fn emit_log(&self, level: &str, message: &str) {
        let _ = self.app.emit(
            "sync-log",
            serde_json::json!({ "level": level, "message": message }),
        );
    }

    fn emit_progress(&self, total: usize, completed: usize, phase: &str) {
        let _ = self.app.emit(
            "sync-initial-progress",
            InitialSyncProgress {
                total,
                completed,
                phase: phase.to_string(),
            },
        );
    }
}

struct LocalFileInfo {
    hash: String,
    #[allow(dead_code)]
    mtime: Option<i64>,
    #[allow(dead_code)]
    size: u64,
}

fn urlencoded(s: &str) -> String {
    s.replace('%', "%25")
        .replace(' ', "%20")
        .replace('#', "%23")
        .replace('&', "%26")
        .replace('?', "%3F")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn remote_file(path: &str, checksum: &str, deleted: bool) -> RemoteFileInfo {
        RemoteFileInfo {
            file_path: path.to_string(),
            checksum: Some(checksum.to_string()),
            version: Some(2),
            snapshot_id: None,
            deleted: Some(deleted),
            size_bytes: None,
            updated_at: None,
            created_at: None,
            last_modified_by: None,
            last_device_id: None,
        }
    }

    fn sync_state(path: &str, ancestor_hash: &str) -> SyncState {
        SyncState {
            file_path: path.to_string(),
            local_hash: Some(ancestor_hash.to_string()),
            remote_hash: Some(ancestor_hash.to_string()),
            ancestor_hash: Some(ancestor_hash.to_string()),
            local_mtime: None,
            remote_mtime: None,
            sync_status: "synced".to_string(),
            last_synced_at: None,
            server_version_id: None,
        }
    }

    fn local_file(hash: &str) -> LocalFileInfo {
        LocalFileInfo {
            hash: hash.to_string(),
            mtime: None,
            size: 0,
        }
    }

    #[test]
    fn identical_initial_sync_has_no_file_operations() {
        let remote = vec![remote_file("same.md", "same", false)];
        let states = vec![sync_state("same.md", "same")];
        let local = HashMap::from([("same.md".to_string(), local_file("same"))]);

        let actions =
            InitialSync::compute_actions(&remote, &states, &local, &SyncPreferences::default());

        assert!(actions.is_empty());
    }

    #[test]
    fn initial_sync_classifies_remote_local_conflict_and_deleted_files() {
        let remote = vec![
            remote_file("remote.md", "remote", false),
            remote_file("pull.md", "remote-new", false),
            remote_file("push.md", "ancestor", false),
            remote_file("conflict.md", "remote-new", false),
            remote_file("deleted.md", "old", true),
        ];
        let states = vec![
            sync_state("pull.md", "ancestor"),
            sync_state("push.md", "ancestor"),
            sync_state("conflict.md", "ancestor"),
            sync_state("deleted.md", "old"),
        ];
        let local = HashMap::from([
            ("pull.md".to_string(), local_file("ancestor")),
            ("push.md".to_string(), local_file("local-new")),
            ("conflict.md".to_string(), local_file("local-new")),
            ("deleted.md".to_string(), local_file("old")),
            ("local.md".to_string(), local_file("local")),
        ]);

        let actions =
            InitialSync::compute_actions(&remote, &states, &local, &SyncPreferences::default());

        assert!(actions.contains(&InitialSyncAction::Download {
            path: "remote.md".to_string(),
            version: 2,
        }));
        assert!(actions.contains(&InitialSyncAction::Download {
            path: "pull.md".to_string(),
            version: 2,
        }));
        assert!(actions.contains(&InitialSyncAction::Upload {
            path: "push.md".to_string(),
        }));
        assert!(actions.contains(&InitialSyncAction::Conflict {
            path: "conflict.md".to_string(),
        }));
        assert!(actions.contains(&InitialSyncAction::Delete {
            path: "deleted.md".to_string(),
        }));
        assert!(actions.contains(&InitialSyncAction::Upload {
            path: "local.md".to_string(),
        }));
    }
}
