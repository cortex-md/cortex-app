use std::path::Path;

use serde::Serialize;

use crate::atomic_fs::atomic_write_bytes;
use crate::sync::crypto;
use crate::sync::db::{SyncDb, SyncState};
use crate::sync::http::SyncHttpClient;
use crate::sync::merge::{self, is_binary, is_json_config, is_markdown, BinaryWinner, MergeResult};
use crate::sync::state::ConflictResolution;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub file_path: String,
    pub local_hash: String,
    pub remote_hash: String,
    pub ancestor_hash: Option<String>,
    pub local_content: Option<String>,
    pub remote_content: Option<String>,
}

pub enum DetectResult {
    NoConflict,
    LocalOnly,
    RemoteOnly,
    Conflict,
}

pub fn detect(
    local_hash: Option<&str>,
    remote_hash: Option<&str>,
    ancestor_hash: Option<&str>,
) -> DetectResult {
    let local = local_hash.unwrap_or("");
    let remote = remote_hash.unwrap_or("");
    let ancestor = ancestor_hash.unwrap_or("");

    if local == remote {
        return DetectResult::NoConflict;
    }

    if ancestor.is_empty() {
        if local.is_empty() {
            return DetectResult::RemoteOnly;
        }
        if remote.is_empty() {
            return DetectResult::LocalOnly;
        }
        return DetectResult::Conflict;
    }

    let local_changed = local != ancestor;
    let remote_changed = remote != ancestor;

    match (local_changed, remote_changed) {
        (false, false) => DetectResult::NoConflict,
        (true, false) => DetectResult::LocalOnly,
        (false, true) => DetectResult::RemoteOnly,
        (true, true) => DetectResult::Conflict,
    }
}

pub struct ConflictResolver<'a> {
    client: &'a SyncHttpClient,
    db: &'a SyncDb,
    vault_id: &'a str,
    vault_path: &'a str,
    vek: &'a [u8; 32],
}

impl<'a> ConflictResolver<'a> {
    pub fn new(
        client: &'a SyncHttpClient,
        db: &'a SyncDb,
        vault_id: &'a str,
        vault_path: &'a str,
        vek: &'a [u8; 32],
    ) -> Self {
        Self {
            client,
            db,
            vault_id,
            vault_path,
            vek,
        }
    }

    pub async fn attempt_auto_merge(
        &self,
        file_path: &str,
        local_content: &[u8],
        remote_content: &[u8],
        sync_state: &SyncState,
    ) -> Result<AutoMergeResult, String> {
        if is_binary(file_path) {
            let winner = merge::merge_binary(sync_state.local_mtime, sync_state.remote_mtime);
            return Ok(match winner {
                BinaryWinner::Local => AutoMergeResult::KeepLocal,
                BinaryWinner::Remote => AutoMergeResult::KeepRemote(remote_content.to_vec()),
            });
        }

        let local_text =
            std::str::from_utf8(local_content).map_err(|_| "Local content is not UTF-8")?;
        let remote_text =
            std::str::from_utf8(remote_content).map_err(|_| "Remote content is not UTF-8")?;

        let ancestor_text = self
            .fetch_ancestor(file_path, sync_state)
            .await
            .unwrap_or_default();

        if is_markdown(file_path) {
            let result = merge::merge_markdown(&ancestor_text, local_text, remote_text);
            match result {
                MergeResult::Clean(merged) => Ok(AutoMergeResult::Merged(merged.into_bytes())),
                MergeResult::WithConflicts(conflict_text) => {
                    Ok(AutoMergeResult::NeedsManualResolution {
                        local_text: local_text.to_string(),
                        remote_text: remote_text.to_string(),
                        conflict_text,
                    })
                }
            }
        } else if is_json_config(file_path) {
            match merge::merge_json(&ancestor_text, local_text, remote_text) {
                Ok(MergeResult::Clean(merged)) => Ok(AutoMergeResult::Merged(merged.into_bytes())),
                Ok(MergeResult::WithConflicts(_)) | Err(_) => {
                    Ok(AutoMergeResult::NeedsManualResolution {
                        local_text: local_text.to_string(),
                        remote_text: remote_text.to_string(),
                        conflict_text: format!(
                            "<<<<<<< LOCAL\n{}\n=======\n{}\n>>>>>>> REMOTE\n",
                            local_text, remote_text
                        ),
                    })
                }
            }
        } else {
            let winner = merge::merge_binary(sync_state.local_mtime, sync_state.remote_mtime);
            Ok(match winner {
                BinaryWinner::Local => AutoMergeResult::KeepLocal,
                BinaryWinner::Remote => AutoMergeResult::KeepRemote(remote_content.to_vec()),
            })
        }
    }

    pub async fn apply_resolution(
        &self,
        file_path: &str,
        resolution: &ConflictResolution,
    ) -> Result<(), String> {
        let full_path = Path::new(self.vault_path).join(file_path);

        match resolution {
            ConflictResolution::KeepLocal => {
                let content = std::fs::read(&full_path).map_err(|e| e.to_string())?;
                let local_hash = blake3::hash(&content).to_hex().to_string();
                self.upload_resolved(file_path, &content, &local_hash)
                    .await?;
            }
            ConflictResolution::KeepRemote => {
                let remote_content = self.download_latest(file_path).await?;
                let remote_hash = blake3::hash(&remote_content).to_hex().to_string();
                atomic_write_bytes(&full_path, &remote_content)?;
                self.update_sync_state_resolved(file_path, &remote_hash)?;
            }
            ConflictResolution::Merged { content } => {
                let bytes = content.as_bytes();
                let merged_hash = blake3::hash(bytes).to_hex().to_string();
                atomic_write_bytes(&full_path, bytes)?;
                self.upload_resolved(file_path, bytes, &merged_hash).await?;
            }
        }

        Ok(())
    }

    async fn fetch_ancestor(
        &self,
        file_path: &str,
        sync_state: &SyncState,
    ) -> Result<String, String> {
        let version_id = sync_state
            .server_version_id
            .as_deref()
            .ok_or("No server version ID for ancestor")?;

        let api_path = format!(
            "/sync/v1/vaults/{}/files?path={}&version={}",
            self.vault_id,
            urlencoded(file_path),
            version_id
        );

        let response = self.client.get(&api_path).await?;
        if !response.status().is_success() {
            return Err("Failed to fetch ancestor version".to_string());
        }

        let encrypted = response.bytes().await.map_err(|e| e.to_string())?;
        let plaintext = crypto::decrypt(&encrypted, self.vek)?;
        String::from_utf8(plaintext).map_err(|e| e.to_string())
    }

    async fn download_latest(&self, file_path: &str) -> Result<Vec<u8>, String> {
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

        let encrypted = response.bytes().await.map_err(|e| e.to_string())?;
        crypto::decrypt(&encrypted, self.vek)
    }

    async fn upload_resolved(
        &self,
        file_path: &str,
        content: &[u8],
        hash: &str,
    ) -> Result<(), String> {
        let encrypted = crypto::encrypt(content, self.vek)?;
        let api_path = format!("/sync/v1/vaults/{}/files", self.vault_id);

        let headers = vec![
            ("X-File-Path".to_string(), file_path.to_string()),
            ("X-Local-Hash".to_string(), hash.to_string()),
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
            return Err(format!("Upload resolved failed: {}", body));
        }

        let response_body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let snapshot_id = response_body["snapshot_id"].as_str().map(|s| s.to_string());
        let version = response_body["version"].as_u64();

        self.update_sync_state_resolved_with_server(file_path, hash, snapshot_id, version)?;

        Ok(())
    }

    fn update_sync_state_resolved(&self, file_path: &str, hash: &str) -> Result<(), String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.db.upsert_sync_state(&SyncState {
            file_path: file_path.to_string(),
            local_hash: Some(hash.to_string()),
            remote_hash: Some(hash.to_string()),
            ancestor_hash: Some(hash.to_string()),
            local_mtime: Some(now),
            remote_mtime: Some(now),
            sync_status: "synced".to_string(),
            last_synced_at: Some(now),
            server_version_id: None,
        })
    }

    fn update_sync_state_resolved_with_server(
        &self,
        file_path: &str,
        hash: &str,
        snapshot_id: Option<String>,
        _version: Option<u64>,
    ) -> Result<(), String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.db.upsert_sync_state(&SyncState {
            file_path: file_path.to_string(),
            local_hash: Some(hash.to_string()),
            remote_hash: Some(hash.to_string()),
            ancestor_hash: Some(hash.to_string()),
            local_mtime: Some(now),
            remote_mtime: Some(now),
            sync_status: "synced".to_string(),
            last_synced_at: Some(now),
            server_version_id: snapshot_id,
        })
    }

    pub fn get_all_conflicts(&self) -> Result<Vec<ConflictInfo>, String> {
        let states = self.db.list_all_sync_states()?;
        let mut conflicts = Vec::new();

        for state in states {
            if state.sync_status == "conflict" {
                let local_content = self.read_local_text(&state.file_path);
                conflicts.push(ConflictInfo {
                    file_path: state.file_path,
                    local_hash: state.local_hash.unwrap_or_default(),
                    remote_hash: state.remote_hash.unwrap_or_default(),
                    ancestor_hash: state.ancestor_hash,
                    local_content,
                    remote_content: None,
                });
            }
        }

        Ok(conflicts)
    }

    fn read_local_text(&self, file_path: &str) -> Option<String> {
        let full_path = Path::new(self.vault_path).join(file_path);
        std::fs::read_to_string(&full_path).ok()
    }
}

pub enum AutoMergeResult {
    KeepLocal,
    KeepRemote(Vec<u8>),
    Merged(Vec<u8>),
    NeedsManualResolution {
        local_text: String,
        remote_text: String,
        conflict_text: String,
    },
}

fn urlencoded(s: &str) -> String {
    s.replace('%', "%25")
        .replace(' ', "%20")
        .replace('#', "%23")
        .replace('&', "%26")
        .replace('?', "%3F")
}
