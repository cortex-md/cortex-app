use std::path::Path;

use crate::sync::crypto;
use crate::sync::db::{NoteSyncMetadata, SyncDb, SyncState};
use crate::sync::http::SyncHttpClient;

pub struct Uploader<'a> {
    client: &'a SyncHttpClient,
    db: &'a SyncDb,
    vault_id: &'a str,
    vault_path: &'a str,
    vek: &'a [u8; 32],
}

impl<'a> Uploader<'a> {
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

    pub async fn upload_file(&self, file_path: &str) -> Result<(), String> {
        let full_path = Path::new(self.vault_path).join(file_path);
        let content = std::fs::read(&full_path).map_err(|e| e.to_string())?;
        let local_hash = blake3::hash(&content).to_hex().to_string();

        if let Some(sync_state) = self.db.get_sync_state(file_path)? {
            if sync_state.local_hash.as_deref() == Some(&local_hash) {
                return Ok(());
            }
        }

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
        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Upload failed: HTTP {}: {}", status.as_u16(), body));
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

    pub async fn delete_remote_file(&self, file_path: &str) -> Result<(), String> {
        let api_path = format!(
            "/sync/v1/vaults/{}/files?path={}",
            self.vault_id,
            urlencoded(file_path)
        );

        let response = self.client.delete(&api_path).await?;
        let status = response.status();

        if !status.is_success() && status.as_u16() != 404 {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Delete failed: HTTP {}: {}", status.as_u16(), body));
        }

        self.db.delete_sync_state(file_path)?;
        Ok(())
    }

    pub async fn rename_remote_file(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let api_path = format!("/sync/v1/vaults/{}/files/rename", self.vault_id);

        let body = serde_json::json!({
            "old_path": old_path,
            "new_path": new_path,
        });

        let response = self.client.post_json(&api_path, &body).await?;
        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Rename failed: HTTP {}: {}", status.as_u16(), body));
        }
        let response_body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

        if let Some(mut state) = self.db.get_sync_state(old_path)? {
            self.db.delete_sync_state(old_path)?;
            state.file_path = new_path.to_string();
            self.db.upsert_sync_state(&state)?;
        }
        self.db.rename_note_metadata(old_path, new_path)?;
        self.db.upsert_note_metadata(
            new_path,
            &NoteSyncMetadata {
                created_at: response_body["created_at"].as_str().map(String::from),
                created_by: None,
                last_edited_at: response_body["updated_at"].as_str().map(String::from),
                last_edited_by: response_body["last_modified_by"].as_str().map(String::from),
                last_device_id: response_body["last_device_id"].as_str().map(String::from),
                synced: true,
                creation_lookup_complete: false,
            },
        )?;

        Ok(())
    }
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
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn duplicate_local_events_result_in_one_upload_request() {
        let server = MockServer::start().await;
        let directory = tempdir().unwrap();
        std::fs::write(directory.path().join("note.md"), b"local note").unwrap();
        let db = SyncDb::open(directory.path().to_str().unwrap()).unwrap();
        Mock::given(method("POST"))
            .and(path("/sync/v1/vaults/vault/files"))
            .and(header("X-File-Path", "note.md"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "snapshot_id": "snapshot-1",
                "version": 1,
                "created_at": "2026-06-14T12:00:00Z",
                "updated_at": "2026-06-14T12:00:00Z",
                "last_modified_by": "user-1",
                "last_device_id": "device-1"
            })))
            .expect(1)
            .mount(&server)
            .await;

        let client = SyncHttpClient::new_for_test(&server.uri());
        let vek = [7_u8; 32];
        let uploader = Uploader::new(
            &client,
            &db,
            "vault",
            directory.path().to_str().unwrap(),
            &vek,
        );

        uploader.upload_file("note.md").await.unwrap();
        uploader.upload_file("note.md").await.unwrap();

        let metadata = db.get_note_metadata("note.md").unwrap().unwrap();
        assert_eq!(metadata.created_by.as_deref(), Some("user-1"));
        assert!(metadata.creation_lookup_complete);
    }

    #[tokio::test]
    async fn failed_upload_does_not_mark_the_file_as_synced() {
        let server = MockServer::start().await;
        let directory = tempdir().unwrap();
        std::fs::write(directory.path().join("note.md"), b"local note").unwrap();
        let db = SyncDb::open(directory.path().to_str().unwrap()).unwrap();
        Mock::given(method("POST"))
            .and(path("/sync/v1/vaults/vault/files"))
            .respond_with(ResponseTemplate::new(503))
            .expect(1)
            .mount(&server)
            .await;

        let client = SyncHttpClient::new_for_test(&server.uri());
        let vek = [7_u8; 32];
        let uploader = Uploader::new(
            &client,
            &db,
            "vault",
            directory.path().to_str().unwrap(),
            &vek,
        );

        assert!(uploader.upload_file("note.md").await.is_err());
        assert!(db.get_sync_state("note.md").unwrap().is_none());
        assert!(db.get_note_metadata("note.md").unwrap().is_none());
    }
}
