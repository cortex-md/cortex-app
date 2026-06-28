use std::time::Duration;

use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::sync::http::{is_subscription_access_error, subscription_code_from_text};
use crate::sync::state::SyncCommand;

#[derive(Debug, Deserialize)]
pub struct SseFileEvent {
    #[allow(dead_code)]
    pub vault_uuid: String,
    pub file_path: String,
    pub version: u64,
    #[allow(dead_code)]
    pub actor_id: String,
    pub device_id: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub old_path: Option<String>,
}

pub struct SseClient {
    command_tx: mpsc::Sender<SyncCommand>,
    own_device_id: String,
    last_event_id: Option<String>,
}

impl SseClient {
    pub fn new(
        command_tx: mpsc::Sender<SyncCommand>,
        own_device_id: String,
        last_event_id: Option<String>,
    ) -> Self {
        Self {
            command_tx,
            own_device_id,
            last_event_id,
        }
    }

    pub async fn connect(
        &mut self,
        url: &str,
        server_url: &str,
        device_id: &str,
        cancel: CancellationToken,
    ) -> Result<(), String> {
        let mut backoff_ms: u64 = 1000;
        let max_backoff_ms: u64 = 300_000;

        loop {
            if cancel.is_cancelled() {
                return Ok(());
            }

            let access_token = match crate::sync::http::get_access_token_for_server(server_url) {
                Ok(Some(token)) => token,
                Ok(None) => {
                    eprintln!("SSE reconnect: no access token for server, aborting");
                    return Err("No access token available for SSE".to_string());
                }
                Err(e) => {
                    eprintln!("SSE reconnect: keychain error: {}, aborting", e);
                    return Err(e);
                }
            };

            match self
                .stream_events(url, &access_token, device_id, &cancel)
                .await
            {
                Ok(()) => {
                    if cancel.is_cancelled() {
                        return Ok(());
                    }
                    let _ = self
                        .command_tx
                        .send(SyncCommand::SseDisconnected {
                            last_event_id: self.last_event_id.clone(),
                        })
                        .await;
                    backoff_ms = 1000;
                }
                Err(e) => {
                    if cancel.is_cancelled() {
                        return Ok(());
                    }

                    if is_subscription_access_error(&e) {
                        let code = subscription_code_from_text(&e).map(String::from);
                        let _ = self
                            .command_tx
                            .send(SyncCommand::AccessDenied {
                                reason: e,
                                kind: "subscription".to_string(),
                                code,
                            })
                            .await;
                        return Ok(());
                    }

                    if e.contains("HTTP 403") {
                        let _ = self
                            .command_tx
                            .send(SyncCommand::AccessDenied {
                                reason: e,
                                kind: "vault".to_string(),
                                code: None,
                            })
                            .await;
                        return Ok(());
                    }

                    let _ = self
                        .command_tx
                        .send(SyncCommand::SseDisconnected {
                            last_event_id: self.last_event_id.clone(),
                        })
                        .await;

                    let jitter = (rand::random::<u64>() % (backoff_ms / 4 + 1)) as u64;
                    let sleep_ms = backoff_ms + jitter;

                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_millis(sleep_ms)) => {}
                        _ = cancel.cancelled() => return Ok(()),
                    }

                    backoff_ms = (backoff_ms * 2).min(max_backoff_ms);
                    let _ = e;
                }
            }
        }
    }

    async fn stream_events(
        &mut self,
        url: &str,
        access_token: &str,
        device_id: &str,
        cancel: &CancellationToken,
    ) -> Result<(), String> {
        let client = reqwest::Client::new();
        let mut builder = client
            .get(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("X-Device-ID", device_id)
            .header("Accept", "text/event-stream");

        if let Some(ref last_id) = self.last_event_id {
            builder = builder.header("Last-Event-ID", last_id);
        }

        let response = builder.send().await.map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            eprintln!(
                "SSE connection failed: HTTP {} - {} (url: {}, device: {})",
                status, body, url, device_id
            );
            return Err(format!("SSE connection failed: HTTP {}: {}", status, body));
        }

        let _ = self.command_tx.send(SyncCommand::SseConnected).await;

        let mut buffer = String::new();
        let mut current_event_type = String::new();
        let mut current_data = String::new();
        let mut current_id = String::new();

        let mut stream = response;
        loop {
            if cancel.is_cancelled() {
                return Ok(());
            }

            let chunk = tokio::select! {
                result = stream.chunk() => {
                    match result {
                        Ok(Some(c)) => c,
                        Ok(None) => break,
                        Err(e) => return Err(e.to_string()),
                    }
                }
                _ = cancel.cancelled() => return Ok(()),
            };

            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim_end_matches('\r').to_string();
                buffer = buffer[line_end + 1..].to_string();

                if line.is_empty() {
                    if !current_data.is_empty() {
                        self.handle_event(&current_event_type, &current_data, &current_id)
                            .await;
                        if !current_id.is_empty() {
                            self.last_event_id = Some(current_id.clone());
                        }
                    }
                    current_event_type.clear();
                    current_data.clear();
                    current_id.clear();
                } else if let Some(value) = line.strip_prefix("event:") {
                    current_event_type = value.trim().to_string();
                } else if let Some(value) = line.strip_prefix("data:") {
                    current_data = value.trim().to_string();
                } else if let Some(value) = line.strip_prefix("id:") {
                    current_id = value.trim().to_string();
                }
            }
        }

        Ok(())
    }

    async fn send_processed_event(&self, event_id: Option<String>) {
        if let Some(event_id) = event_id {
            let _ = self
                .command_tx
                .send(SyncCommand::RemoteEventProcessed { event_id })
                .await;
        }
    }

    async fn handle_event(&self, event_type: &str, data: &str, id: &str) {
        let event_id = (!id.is_empty()).then(|| id.to_string());
        match event_type {
            "file_created" | "file_updated" => {
                if let Ok(event) = serde_json::from_str::<SseFileEvent>(data) {
                    if event.device_id == self.own_device_id {
                        self.send_processed_event(event_id).await;
                        return;
                    }
                    let _ = self
                        .command_tx
                        .send(SyncCommand::RemoteFileChanged {
                            path: event.file_path,
                            version: event.version,
                            actor_id: event.actor_id,
                            device_id: event.device_id,
                            edited_at: event.created_at,
                            created: event_type == "file_created",
                            event_id,
                        })
                        .await;
                }
            }
            "file_deleted" => {
                if let Ok(event) = serde_json::from_str::<SseFileEvent>(data) {
                    if event.device_id == self.own_device_id {
                        self.send_processed_event(event_id).await;
                        return;
                    }
                    let _ = self
                        .command_tx
                        .send(SyncCommand::RemoteFileDeleted {
                            path: event.file_path,
                            event_id,
                        })
                        .await;
                }
            }
            "file_renamed" => {
                if let Ok(event) = serde_json::from_str::<SseFileEvent>(data) {
                    if event.device_id == self.own_device_id {
                        self.send_processed_event(event_id).await;
                        return;
                    }
                    if let Some(old_path) = event.old_path {
                        let _ = self
                            .command_tx
                            .send(SyncCommand::RemoteFileRenamed {
                                old_path,
                                new_path: event.file_path,
                                event_id,
                            })
                            .await;
                    } else {
                        self.send_processed_event(event_id).await;
                    }
                }
            }
            "ping" => {
                self.send_processed_event(event_id).await;
            }
            _ => {
                self.send_processed_event(event_id).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn handle_event_attaches_event_id_to_remote_file_change() {
        let (command_tx, mut command_rx) = mpsc::channel(1);
        let client = SseClient::new(command_tx, "own-device".to_string(), None);
        let data = serde_json::json!({
            "vault_uuid": "vault-1",
            "file_path": "note.md",
            "version": 4,
            "actor_id": "user-1",
            "device_id": "other-device",
            "created_at": "2026-06-25T12:00:00Z"
        })
        .to_string();

        client.handle_event("file_updated", &data, "35").await;

        let command = command_rx.recv().await.unwrap();
        match command {
            SyncCommand::RemoteFileChanged {
                path,
                version,
                event_id,
                ..
            } => {
                assert_eq!(path, "note.md");
                assert_eq!(version, 4);
                assert_eq!(event_id.as_deref(), Some("35"));
            }
            other => panic!("unexpected command: {:?}", other),
        }
    }

    #[tokio::test]
    async fn handle_event_emits_processed_command_for_own_device_event() {
        let (command_tx, mut command_rx) = mpsc::channel(1);
        let client = SseClient::new(command_tx, "own-device".to_string(), None);
        let data = serde_json::json!({
            "vault_uuid": "vault-1",
            "file_path": "note.md",
            "version": 4,
            "actor_id": "user-1",
            "device_id": "own-device",
            "created_at": "2026-06-25T12:00:00Z"
        })
        .to_string();

        client.handle_event("file_updated", &data, "36").await;

        let command = command_rx.recv().await.unwrap();
        match command {
            SyncCommand::RemoteEventProcessed { event_id } => {
                assert_eq!(event_id, "36");
            }
            other => panic!("unexpected command: {:?}", other),
        }
    }

    #[tokio::test]
    async fn handle_event_emits_processed_command_for_unknown_event_type() {
        let (command_tx, mut command_rx) = mpsc::channel(1);
        let client = SseClient::new(command_tx, "own-device".to_string(), None);

        client
            .handle_event("workspace_snapshot_ready", "{}", "37")
            .await;

        let command = command_rx.recv().await.unwrap();
        match command {
            SyncCommand::RemoteEventProcessed { event_id } => {
                assert_eq!(event_id, "37");
            }
            other => panic!("unexpected command: {:?}", other),
        }
    }
}
