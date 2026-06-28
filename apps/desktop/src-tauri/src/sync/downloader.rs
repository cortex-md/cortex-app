use std::path::Path;

use crate::atomic_fs::atomic_write_bytes;
use crate::sync::conflict::{self, AutoMergeResult};
use crate::sync::crypto;
use crate::sync::db::{SyncDb, SyncState};
use crate::sync::http::SyncHttpClient;

pub struct Downloader<'a> {
    client: &'a SyncHttpClient,
    db: &'a SyncDb,
    vault_id: &'a str,
    vault_path: &'a str,
    vek: &'a [u8; 32],
}

impl<'a> Downloader<'a> {
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

    pub async fn download_file(&self, file_path: &str) -> Result<DownloadResult, String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files?path={}",
            self.vault_id,
            urlencoded(file_path)
        );

        let response = self.client.get(&api_path).await?;
        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "Download failed: HTTP {}: {}",
                status.as_u16(),
                body
            ));
        }

        let snapshot_id = response
            .headers()
            .get("X-Snapshot-ID")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let encrypted = response.bytes().await.map_err(|e| e.to_string())?;
        let plaintext = crypto::decrypt(&encrypted, self.vek)?;
        let remote_hash = blake3::hash(&plaintext).to_hex().to_string();

        let full_path = Path::new(self.vault_path).join(file_path);
        let existing_state = self.db.get_sync_state(file_path)?;

        if full_path.exists() {
            if let Some(ref state) = existing_state {
                let local_content = std::fs::read(&full_path).map_err(|e| e.to_string())?;
                let local_hash = blake3::hash(&local_content).to_hex().to_string();

                if local_hash == remote_hash {
                    self.update_state_synced(file_path, &remote_hash, snapshot_id.clone())?;
                    return Ok(DownloadResult::Synced);
                }

                let detection = conflict::detect(
                    Some(&local_hash),
                    Some(&remote_hash),
                    state.ancestor_hash.as_deref(),
                );

                match detection {
                    conflict::DetectResult::Conflict => {
                        let resolver = conflict::ConflictResolver::new(
                            self.client,
                            self.db,
                            self.vault_id,
                            self.vault_path,
                            self.vek,
                        );

                        match resolver
                            .attempt_auto_merge(file_path, &local_content, &plaintext, state)
                            .await?
                        {
                            AutoMergeResult::KeepLocal => {
                                return Ok(DownloadResult::Synced);
                            }
                            AutoMergeResult::KeepRemote(content) => {
                                self.write_and_update(
                                    file_path,
                                    &content,
                                    &remote_hash,
                                    snapshot_id,
                                )?;
                                return Ok(DownloadResult::Synced);
                            }
                            AutoMergeResult::Merged(merged) => {
                                let merged_hash = blake3::hash(&merged).to_hex().to_string();
                                self.write_and_update(
                                    file_path,
                                    &merged,
                                    &merged_hash,
                                    snapshot_id,
                                )?;
                                return Ok(DownloadResult::Merged);
                            }
                            AutoMergeResult::NeedsManualResolution {
                                local_text,
                                remote_text,
                                conflict_text,
                            } => {
                                atomic_write_bytes(&full_path, conflict_text.as_bytes())?;

                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_secs() as i64;

                                self.db.upsert_sync_state(&SyncState {
                                    file_path: file_path.to_string(),
                                    local_hash: Some(local_hash),
                                    remote_hash: Some(remote_hash),
                                    ancestor_hash: state.ancestor_hash.clone(),
                                    local_mtime: Some(now),
                                    remote_mtime: Some(now),
                                    sync_status: "conflict".to_string(),
                                    last_synced_at: state.last_synced_at,
                                    server_version_id: snapshot_id,
                                })?;

                                return Ok(DownloadResult::Conflict {
                                    local_text,
                                    remote_text,
                                });
                            }
                        }
                    }
                    conflict::DetectResult::LocalOnly => {
                        return Ok(DownloadResult::Synced);
                    }
                    _ => {}
                }
            }
        }

        self.write_and_update(file_path, &plaintext, &remote_hash, snapshot_id)?;
        Ok(DownloadResult::Synced)
    }

    pub async fn download_version(
        &self,
        file_path: &str,
        version: &str,
    ) -> Result<Vec<u8>, String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files?path={}&version={}",
            self.vault_id,
            urlencoded(file_path),
            version
        );

        let response = self.client.get(&api_path).await?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Download version failed: {}", body));
        }

        let encrypted = response.bytes().await.map_err(|e| e.to_string())?;
        crypto::decrypt(&encrypted, self.vek)
    }

    pub async fn get_version_history(&self, file_path: &str) -> Result<Vec<VersionInfo>, String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files/history?path={}",
            self.vault_id,
            urlencoded(file_path)
        );

        let response = self.client.get(&api_path).await?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "Version history failed with HTTP {}: {}",
                status.as_u16(),
                body
            ));
        }

        let versions: Vec<VersionInfo> = response.json().await.map_err(|e| e.to_string())?;
        Ok(versions)
    }

    fn write_and_update(
        &self,
        file_path: &str,
        content: &[u8],
        hash: &str,
        snapshot_id: Option<String>,
    ) -> Result<(), String> {
        let full_path = Path::new(self.vault_path).join(file_path);
        atomic_write_bytes(&full_path, content)?;
        self.update_state_synced(file_path, hash, snapshot_id)
    }

    fn update_state_synced(
        &self,
        file_path: &str,
        hash: &str,
        snapshot_id: Option<String>,
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

    pub async fn delete_local_file(&self, file_path: &str) -> Result<(), String> {
        let full_path = Path::new(self.vault_path).join(file_path);
        if full_path.exists() {
            std::fs::remove_file(&full_path).map_err(|e| e.to_string())?;
        }
        self.db.delete_sync_state(file_path)?;
        Ok(())
    }

    pub async fn list_deleted_files(&self) -> Result<Vec<DeletedFileInfo>, String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files/list?include_deleted=true",
            self.vault_id
        );

        let response = self.client.get(&api_path).await?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("List files failed: {}", body));
        }

        let entries: Vec<RemoteFileListEntry> = response.json().await.map_err(|e| e.to_string())?;

        let deleted = entries
            .into_iter()
            .filter(|e| e.deleted.unwrap_or(false))
            .map(|e| DeletedFileInfo {
                file_path: e.file_path,
                version: e.version.unwrap_or(0),
                size_bytes: e.size_bytes,
                checksum: e.checksum,
                content_type: e.content_type,
                deleted_at: e.updated_at,
                last_modified_by: e.last_modified_by,
                last_device_id: e.last_device_id,
            })
            .collect();

        Ok(deleted)
    }

    pub async fn restore_deleted_file(&self, file_path: &str) -> Result<(), String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files/restore?path={}",
            self.vault_id,
            urlencoded(file_path)
        );

        let empty: serde_json::Value = serde_json::json!({});
        let response = self.client.post_json(&api_path, &empty).await?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Restore file failed: {}", body));
        }

        let content = self.download_version(file_path, "0").await?;
        let full_path = Path::new(self.vault_path).join(file_path);
        atomic_write_bytes(&full_path, &content)?;

        let hash = blake3::hash(&content).to_hex().to_string();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.db.upsert_sync_state(&SyncState {
            file_path: file_path.to_string(),
            local_hash: Some(hash.clone()),
            remote_hash: Some(hash.clone()),
            ancestor_hash: Some(hash),
            local_mtime: Some(now),
            remote_mtime: Some(now),
            sync_status: "synced".to_string(),
            last_synced_at: Some(now),
            server_version_id: None,
        })?;

        Ok(())
    }

    pub async fn rename_local_file(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let old_full = Path::new(self.vault_path).join(old_path);
        let new_full = Path::new(self.vault_path).join(new_path);
        if let Some(parent) = new_full.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        if old_full.exists() {
            std::fs::rename(&old_full, &new_full).map_err(|e| e.to_string())?;
        }

        if let Some(mut state) = self.db.get_sync_state(old_path)? {
            self.db.delete_sync_state(old_path)?;
            state.file_path = new_path.to_string();
            self.db.upsert_sync_state(&state)?;
        }
        self.db.rename_note_metadata(old_path, new_path)?;

        Ok(())
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct RemoteFileListEntry {
    file_path: String,
    version: Option<u64>,
    size_bytes: Option<u64>,
    checksum: Option<String>,
    content_type: Option<String>,
    deleted: Option<bool>,
    updated_at: Option<String>,
    last_modified_by: Option<String>,
    last_device_id: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeletedFileInfo {
    pub file_path: String,
    pub version: u64,
    pub size_bytes: Option<u64>,
    pub checksum: Option<String>,
    pub content_type: Option<String>,
    pub deleted_at: Option<String>,
    pub last_modified_by: Option<String>,
    pub last_device_id: Option<String>,
}

pub enum DownloadResult {
    Synced,
    Merged,
    Conflict {
        #[allow(dead_code)]
        local_text: String,
        #[allow(dead_code)]
        remote_text: String,
    },
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct VersionInfo {
    pub snapshot_id: String,
    pub version: u64,
    pub size_bytes: Option<u64>,
    pub checksum: Option<String>,
    #[serde(alias = "created_by")]
    pub author_id: Option<String>,
    pub author_name: Option<String>,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub created_at: Option<String>,
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
    use tempfile::tempdir;
    use wiremock::matchers::{method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn downloads_remote_content_and_updates_state_after_the_write() {
        let server = MockServer::start().await;
        let directory = tempdir().unwrap();
        let db = SyncDb::open(directory.path().to_str().unwrap()).unwrap();
        let vek = [7_u8; 32];
        let plaintext = b"remote note";
        let encrypted = crypto::encrypt(plaintext, &vek).unwrap();
        Mock::given(method("GET"))
            .and(path("/sync/v1/vaults/vault/files"))
            .and(query_param("path", "note.md"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("X-Snapshot-ID", "snapshot-1")
                    .set_body_bytes(encrypted),
            )
            .expect(1)
            .mount(&server)
            .await;

        let client = SyncHttpClient::new_for_test(&server.uri());
        let downloader = Downloader::new(
            &client,
            &db,
            "vault",
            directory.path().to_str().unwrap(),
            &vek,
        );

        downloader.download_file("note.md").await.unwrap();

        assert_eq!(
            std::fs::read(directory.path().join("note.md")).unwrap(),
            plaintext
        );
        let expected_hash = blake3::hash(plaintext).to_hex().to_string();
        let state = db.get_sync_state("note.md").unwrap().unwrap();
        assert_eq!(state.local_hash.as_deref(), Some(expected_hash.as_str()));
        assert_eq!(state.server_version_id.as_deref(), Some("snapshot-1"));
    }

    #[tokio::test]
    async fn decrypt_failure_preserves_the_previous_file_and_state() {
        let server = MockServer::start().await;
        let directory = tempdir().unwrap();
        let file_path = directory.path().join("note.md");
        std::fs::write(&file_path, b"local note").unwrap();
        let db = SyncDb::open(directory.path().to_str().unwrap()).unwrap();
        db.upsert_sync_state(&SyncState {
            file_path: "note.md".to_string(),
            local_hash: Some("old-local".to_string()),
            remote_hash: Some("old-remote".to_string()),
            ancestor_hash: Some("old-ancestor".to_string()),
            local_mtime: None,
            remote_mtime: None,
            sync_status: "synced".to_string(),
            last_synced_at: None,
            server_version_id: Some("old-snapshot".to_string()),
        })
        .unwrap();
        Mock::given(method("GET"))
            .and(path("/sync/v1/vaults/vault/files"))
            .and(query_param("path", "note.md"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(vec![1, 2, 3]))
            .expect(1)
            .mount(&server)
            .await;

        let client = SyncHttpClient::new_for_test(&server.uri());
        let vek = [7_u8; 32];
        let downloader = Downloader::new(
            &client,
            &db,
            "vault",
            directory.path().to_str().unwrap(),
            &vek,
        );

        assert!(downloader.download_file("note.md").await.is_err());
        assert_eq!(std::fs::read(&file_path).unwrap(), b"local note");
        let state = db.get_sync_state("note.md").unwrap().unwrap();
        assert_eq!(state.local_hash.as_deref(), Some("old-local"));
        assert_eq!(state.server_version_id.as_deref(), Some("old-snapshot"));
    }
}
