use std::collections::{BTreeSet, HashMap};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::sync::conflict::ConflictResolver;
use crate::sync::crypto;
use crate::sync::db::{NoteSyncMetadata, SyncDb};
use crate::sync::downloader::{DownloadResult, Downloader};
use crate::sync::http::{
    is_subscription_access_error, subscription_access_message, subscription_code_from_text,
    SyncHttpClient,
};
use crate::sync::ignore::{should_ignore, SyncPreferences};
use crate::sync::initial::InitialSync;
use crate::sync::paths::to_vault_relative_path;
use crate::sync::queue::{QueueItem, SyncOp, SyncQueue};
use crate::sync::reconcile::Reconciler;
use crate::sync::sse::SseClient;
use crate::sync::state::{
    is_retriable_sync_error_message, ConnectionMode, SyncCommand, SyncEngineState,
};
use crate::sync::uploader::Uploader;

const UPLOAD_DEBOUNCE: Duration = Duration::from_secs(5);
const DELETE_CORRELATION_WINDOW: Duration = Duration::from_millis(1000);
const POLL_INTERVAL: Duration = Duration::from_secs(30);
const RETRY_RELOAD_INTERVAL: Duration = Duration::from_secs(60);

struct QueuePulseBudget {
    remaining: usize,
}

impl QueuePulseBudget {
    fn single_item() -> Self {
        Self { remaining: 1 }
    }

    fn pop_next(&mut self, queue: &mut SyncQueue) -> Option<QueueItem> {
        if self.remaining == 0 {
            return None;
        }
        let item = queue.pop();
        if item.is_some() {
            self.remaining -= 1;
        }
        item
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SyncStateEvent {
    state: SyncEngineState,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SyncFileEvent {
    path: String,
    status: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SyncLogEvent {
    level: String,
    message: String,
}

fn matches_synced_hash(db: Option<&SyncDb>, path: &str, hash: &str) -> bool {
    db.and_then(|database| database.get_sync_state(path).ok().flatten())
        .and_then(|state| state.local_hash)
        .is_some_and(|synced_hash| synced_hash == hash)
}

fn complete_creation_lookup(db: &SyncDb, path: &str) -> Result<(), String> {
    db.upsert_note_metadata(
        path,
        &NoteSyncMetadata {
            created_at: None,
            created_by: None,
            last_edited_at: None,
            last_edited_by: None,
            last_device_id: None,
            synced: true,
            creation_lookup_complete: true,
        },
    )
}

fn parse_sync_event_id(event_id: &str, label: &str) -> Result<u64, String> {
    event_id
        .parse::<u64>()
        .map_err(|_| format!("{} event ID is not numeric: {}", label, event_id))
}

fn current_processed_event_id(last_event_id: Option<&str>) -> Result<u64, String> {
    last_event_id
        .filter(|current| !current.is_empty())
        .map(|current| parse_sync_event_id(current, "stored"))
        .transpose()
        .map(|current| current.unwrap_or(0))
}

fn queued_source_event_ids(db: Option<&SyncDb>) -> Result<Vec<u64>, String> {
    let Some(db) = db else {
        return Ok(Vec::new());
    };
    db.list_queued_source_event_ids()?
        .into_iter()
        .map(|event_id| parse_sync_event_id(&event_id, "queued source"))
        .collect()
}

fn record_processed_event(
    last_event_id: &mut Option<String>,
    processed_event_ids: &mut BTreeSet<u64>,
    db: Option<&SyncDb>,
    event_id: &str,
) -> Result<bool, String> {
    if event_id.is_empty() {
        return Ok(false);
    }

    let processed_event_id = parse_sync_event_id(event_id, "processed")?;
    let current_event_id = current_processed_event_id(last_event_id.as_deref())?;
    if processed_event_id <= current_event_id {
        return Ok(false);
    }

    processed_event_ids.insert(processed_event_id);
    let queued_event_ids = queued_source_event_ids(db)?;
    let next_event_id = processed_event_ids
        .iter()
        .copied()
        .filter(|candidate| *candidate > current_event_id)
        .filter(|candidate| {
            queued_event_ids
                .iter()
                .all(|queued| *queued <= current_event_id || *queued > *candidate)
        })
        .max();

    let Some(next_event_id) = next_event_id else {
        return Ok(false);
    };

    let next_event_id = next_event_id.to_string();
    *last_event_id = Some(next_event_id.clone());
    if let Some(db) = db {
        db.set_metadata("last_event_id", &next_event_id)?;
    }
    let advanced_event_id = parse_sync_event_id(&next_event_id, "processed")?;
    processed_event_ids.retain(|event_id| *event_id > advanced_event_id);
    Ok(true)
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct PollEvent {
    id: i64,
    event_type: String,
    file_path: String,
    version: Option<u64>,
    device_id: String,
    actor_id: String,
    created_at: String,
    metadata: Option<serde_json::Value>,
}

struct PlannedPollEvent {
    queue_item: Option<(SyncOp, u32, String)>,
    note_metadata: Option<(String, NoteSyncMetadata)>,
    processed_event_id: Option<String>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum QueueProcessOutcome {
    Completed,
    #[allow(dead_code)]
    Failed,
}

fn advance_cursor_for_queue_outcome(
    last_event_id: &mut Option<String>,
    processed_event_ids: &mut BTreeSet<u64>,
    db: Option<&SyncDb>,
    item: &QueueItem,
    outcome: QueueProcessOutcome,
) -> Result<bool, String> {
    if outcome != QueueProcessOutcome::Completed {
        return Ok(false);
    }
    let Some(event_id) = item.source_event_id.as_deref() else {
        return Ok(false);
    };
    record_processed_event(last_event_id, processed_event_ids, db, event_id)
}

fn complete_queue_item_and_advance_cursor(
    queue: &SyncQueue,
    last_event_id: &mut Option<String>,
    processed_event_ids: &mut BTreeSet<u64>,
    db: Option<&SyncDb>,
    item: &QueueItem,
) -> Result<bool, String> {
    queue.mark_completed(item);
    advance_cursor_for_queue_outcome(
        last_event_id,
        processed_event_ids,
        db,
        item,
        QueueProcessOutcome::Completed,
    )
}

fn plan_poll_event(
    event: &PollEvent,
    own_device_id: &str,
    sync_preferences: &SyncPreferences,
) -> PlannedPollEvent {
    let event_id = event.id.to_string();
    if event.device_id == own_device_id || should_ignore(&event.file_path, sync_preferences) {
        return PlannedPollEvent {
            queue_item: None,
            note_metadata: None,
            processed_event_id: Some(event_id),
        };
    }

    let note_metadata = match event.event_type.as_str() {
        "file_created" | "file_updated" | "file_renamed" => Some((
            event.file_path.clone(),
            NoteSyncMetadata {
                created_at: (event.event_type == "file_created").then(|| event.created_at.clone()),
                created_by: (event.event_type == "file_created").then(|| event.actor_id.clone()),
                last_edited_at: Some(event.created_at.clone()),
                last_edited_by: Some(event.actor_id.clone()),
                last_device_id: Some(event.device_id.clone()),
                synced: true,
                creation_lookup_complete: event.event_type == "file_created",
            },
        )),
        "file_deleted" => None,
        _ => None,
    };

    let queue_item = match event.event_type.as_str() {
        "file_created" | "file_updated" => {
            let (op, priority) =
                SyncQueue::download(event.file_path.clone(), event.version.unwrap_or(1));
            Some((op, priority, event_id.clone()))
        }
        "file_deleted" => Some((
            SyncOp::Delete {
                path: event.file_path.clone(),
            },
            80,
            event_id.clone(),
        )),
        "file_renamed" => {
            let old_path = event
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("old_path"))
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_string();

            if old_path.is_empty() {
                let (op, priority) =
                    SyncQueue::download(event.file_path.clone(), event.version.unwrap_or(1));
                Some((op, priority, event_id.clone()))
            } else {
                Some((
                    SyncOp::Rename {
                        old_path,
                        new_path: event.file_path.clone(),
                    },
                    80,
                    event_id.clone(),
                ))
            }
        }
        _ => None,
    };
    let processed_event_id = queue_item.is_none().then_some(event_id);

    PlannedPollEvent {
        queue_item,
        note_metadata,
        processed_event_id,
    }
}

pub struct SyncEngine {
    app: AppHandle,
    state: SyncEngineState,
    queue: SyncQueue,
    vault_id: Option<String>,
    vault_path: Option<String>,
    server_url: Option<String>,
    db: Option<Arc<SyncDb>>,
    vek: Option<[u8; 32]>,
    pending_uploads: HashMap<String, Instant>,
    pending_deletes: HashMap<String, (Instant, Option<String>)>,
    sse_cancel: Option<CancellationToken>,
    connection_mode: ConnectionMode,
    last_event_id: Option<String>,
    processed_remote_event_ids: BTreeSet<u64>,
    sync_preferences: SyncPreferences,
}

impl SyncEngine {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            state: SyncEngineState::Idle,
            queue: SyncQueue::new(),
            vault_id: None,
            vault_path: None,
            server_url: None,
            db: None,
            vek: None,
            pending_uploads: HashMap::new(),
            pending_deletes: HashMap::new(),
            sse_cancel: None,
            connection_mode: ConnectionMode::Disconnected,
            last_event_id: None,
            processed_remote_event_ids: BTreeSet::new(),
            sync_preferences: SyncPreferences::default(),
        }
    }

    fn set_state(&mut self, new_state: SyncEngineState) {
        if self.state != new_state {
            self.state = new_state.clone();
            if let Ok(state_str) = serde_json::to_value(&new_state) {
                self.emit_log(
                    "info",
                    &format!("Sync state: {}", state_str.as_str().unwrap_or("unknown")),
                );
            }
            let _ = self
                .app
                .emit("sync-state-changed", SyncStateEvent { state: new_state });
        }
    }

    fn emit_log(&self, level: &str, message: &str) {
        let _ = self.app.emit(
            "sync-log",
            SyncLogEvent {
                level: level.to_string(),
                message: message.to_string(),
            },
        );
    }

    fn emit_file_event(&self, path: &str, status: &str) {
        let _ = self.app.emit(
            "sync-file-event",
            SyncFileEvent {
                path: path.to_string(),
                status: status.to_string(),
            },
        );
    }

    fn mark_event_processed(&mut self, event_id: &str) {
        if let Err(error) = record_processed_event(
            &mut self.last_event_id,
            &mut self.processed_remote_event_ids,
            self.db.as_deref(),
            event_id,
        ) {
            self.emit_log(
                "warn",
                &format!("Skipping sync cursor advancement: {}", error),
            );
        }
    }

    pub async fn run(mut self, mut rx: mpsc::Receiver<SyncCommand>) {
        let mut debounce_interval = tokio::time::interval(Duration::from_secs(1));
        let mut poll_interval = tokio::time::interval(POLL_INTERVAL);
        let mut retry_reload_interval = tokio::time::interval(RETRY_RELOAD_INTERVAL);
        let mut queue_interval = tokio::time::interval(Duration::from_millis(25));

        loop {
            tokio::select! {
                cmd = rx.recv() => {
                    match cmd {
                        Some(SyncCommand::Start {
                            vault_id,
                            vault_path,
                            server_url,
                            requires_entitlement,
                        }) => {
                            self.handle_start(
                                vault_id,
                                vault_path,
                                server_url,
                                requires_entitlement,
                            )
                            .await;
                        }
                        Some(SyncCommand::Stop) => {
                            self.handle_stop();
                        }
                        Some(SyncCommand::LocalFileChanged { path }) => {
                            let relative = self.to_relative_path(&path);
                            if !should_ignore(&relative, &self.sync_preferences) {
                                self.handle_local_file_changed(relative);
                            }
                        }
                        Some(SyncCommand::LocalFileDeleted { path }) => {
                            let relative = self.to_relative_path(&path);
                            if !should_ignore(&relative, &self.sync_preferences) {
                                self.handle_local_file_deleted(relative);
                            }
                        }
                        Some(SyncCommand::ForceSyncFile { path }) => {
                            let relative = self.to_relative_path(&path);
                            if !should_ignore(&relative, &self.sync_preferences) {
                                self.pending_uploads.remove(&relative);
                                let (op, priority) = SyncQueue::upload(relative);
                                self.queue.push(op, priority);
                            }
                        }
                        Some(SyncCommand::RemoteFileChanged {
                            path,
                            version,
                            actor_id,
                            device_id,
                            edited_at,
                            created,
                            event_id,
                        }) => {
                            if !should_ignore(&path, &self.sync_preferences) {
                                if let Some(db) = &self.db {
                                    let _ = db.upsert_note_metadata(
                                        &path,
                                        &NoteSyncMetadata {
                                            created_at: created.then(|| edited_at.clone()).flatten(),
                                            created_by: created.then(|| actor_id.clone()),
                                            last_edited_at: edited_at,
                                            last_edited_by: Some(actor_id),
                                            last_device_id: Some(device_id),
                                            synced: true,
                                            creation_lookup_complete: created,
                                        },
                                    );
                                }
                                let (op, priority) = SyncQueue::download(path, version);
                                if let Some(event_id) = event_id {
                                    if let Err(error) =
                                        self.queue.push_from_event(op, priority, event_id)
                                    {
                                        self.emit_log(
                                            "warn",
                                            &format!("Skipping queued remote event: {}", error),
                                        );
                                    }
                                } else {
                                    self.queue.push(op, priority);
                                }
                            } else if let Some(event_id) = event_id {
                                self.mark_event_processed(&event_id);
                            }
                        }
                        Some(SyncCommand::RemoteFileDeleted { path, event_id }) => {
                            if !should_ignore(&path, &self.sync_preferences) {
                                if let Some(event_id) = event_id {
                                    if let Err(error) = self.queue.push_from_event(
                                        SyncOp::Delete { path },
                                        80,
                                        event_id,
                                    ) {
                                        self.emit_log(
                                            "warn",
                                            &format!("Skipping queued remote event: {}", error),
                                        );
                                    }
                                } else {
                                    self.queue.push(SyncOp::Delete { path }, 80);
                                }
                            } else if let Some(event_id) = event_id {
                                self.mark_event_processed(&event_id);
                            }
                        }
                        Some(SyncCommand::RemoteFileRenamed {
                            old_path,
                            new_path,
                            event_id,
                        }) => {
                            if !should_ignore(&new_path, &self.sync_preferences) {
                                if let Some(event_id) = event_id {
                                    if let Err(error) = self.queue.push_from_event(
                                        SyncOp::Rename { old_path, new_path },
                                        80,
                                        event_id,
                                    ) {
                                        self.emit_log(
                                            "warn",
                                            &format!("Skipping queued remote event: {}", error),
                                        );
                                    }
                                } else {
                                    self.queue.push(SyncOp::Rename { old_path, new_path }, 80);
                                }
                            } else if let Some(event_id) = event_id {
                                self.mark_event_processed(&event_id);
                            }
                        }
                        Some(SyncCommand::RemoteEventProcessed { event_id }) => {
                            self.mark_event_processed(&event_id);
                        }
                        Some(SyncCommand::ResolveConflict { path, resolution }) => {
                            let (_op, priority) = SyncQueue::conflict(path.clone());
                            self.queue.push(
                                SyncOp::ResolveConflict { path, resolution: Some(resolution) },
                                priority,
                            );
                        }
                        Some(SyncCommand::AccessDenied { reason, kind, code }) => {
                            self.handle_access_denied(&reason, &kind, code.as_deref());
                        }
                        Some(SyncCommand::SseConnected) => {
                            self.handle_sse_connected().await;
                        }
                        Some(SyncCommand::SseDisconnected { last_event_id }) => {
                            self.handle_sse_disconnected(last_event_id);
                        }
                        Some(SyncCommand::Reconcile) => {
                            self.handle_reconcile().await;
                        }
                        Some(SyncCommand::PollTick) => {
                            self.handle_poll_tick().await;
                        }
                        Some(SyncCommand::UpdateSyncPreferences {
                            sync_settings,
                            sync_hotkeys,
                            sync_workspace,
                            sync_plugin_metadata,
                            sync_theme_metadata,
                            sync_bookmarks,
                            ignore_images,
                            excluded_paths,
                        }) => {
                            self.handle_update_sync_preferences(
                                sync_settings,
                                sync_hotkeys,
                                sync_workspace,
                                sync_plugin_metadata,
                                sync_theme_metadata,
                                sync_bookmarks,
                                ignore_images,
                                excluded_paths,
                            );
                        }
                        None => break,
                    }
                }
                _ = debounce_interval.tick() => {
                    self.flush_pending_uploads();
                    self.flush_pending_deletes();
                }
                _ = poll_interval.tick() => {
                    if matches!(self.connection_mode, ConnectionMode::Polling) && self.vault_id.is_some() {
                        self.handle_poll_tick().await;
                    }
                }
                _ = retry_reload_interval.tick() => {
                    if self.vault_id.is_some() {
                        let _ = self.queue.reload_ready();
                    }
                }
                _ = queue_interval.tick(), if !self.queue.is_empty() => {
                    self.process_next_queue_item().await;
                }
            }
        }
    }

    fn handle_local_file_changed(&mut self, relative: String) {
        if let Some(vault_path) = &self.vault_path {
            let full_path = std::path::Path::new(vault_path).join(&relative);
            if let Ok(content) = std::fs::read(&full_path) {
                let new_hash = blake3::hash(&content).to_hex().to_string();
                if matches_synced_hash(self.db.as_deref(), &relative, &new_hash) {
                    return;
                }

                let mut matched_old_path: Option<String> = None;
                for (del_path, (del_time, del_hash)) in &self.pending_deletes {
                    if Instant::now().duration_since(*del_time) <= DELETE_CORRELATION_WINDOW {
                        if let Some(ref h) = del_hash {
                            if h == &new_hash {
                                matched_old_path = Some(del_path.clone());
                                break;
                            }
                        }
                    }
                }

                if let Some(old_path) = matched_old_path {
                    self.pending_deletes.remove(&old_path);
                    let (op, priority) = SyncQueue::rename_remote(old_path, relative);
                    self.queue.push(op, priority);
                    return;
                }
            }
        }

        self.pending_uploads.insert(relative, Instant::now());
    }

    fn handle_local_file_deleted(&mut self, relative: String) {
        self.pending_uploads.remove(&relative);

        let last_hash = self
            .db
            .as_ref()
            .and_then(|db| db.get_sync_state(&relative).ok().flatten())
            .and_then(|state| state.local_hash);

        self.pending_deletes
            .insert(relative, (Instant::now(), last_hash));
    }

    fn flush_pending_deletes(&mut self) {
        let now = Instant::now();
        let ready: Vec<String> = self
            .pending_deletes
            .iter()
            .filter(|(_, (when, _))| now.duration_since(*when) > DELETE_CORRELATION_WINDOW)
            .map(|(path, _)| path.clone())
            .collect();

        for path in ready {
            self.pending_deletes.remove(&path);
            if should_ignore(&path, &self.sync_preferences) {
                continue;
            }
            let (op, priority) = SyncQueue::delete_remote(path);
            self.queue.push(op, priority);
        }
    }

    async fn handle_start(
        &mut self,
        vault_id: String,
        vault_path: String,
        server_url: String,
        requires_entitlement: bool,
    ) {
        self.set_state(SyncEngineState::Connecting);

        if let Some(client) = self.app.try_state::<SyncHttpClient>() {
            client.set_server_url(&server_url);
            if requires_entitlement {
                match self.validate_subscription(&client).await {
                    Ok(()) => {}
                    Err(reason) => {
                        self.handle_access_denied(
                            &reason,
                            "subscription",
                            subscription_code_from_text(&reason),
                        );
                        return;
                    }
                }
            }
        }

        match SyncDb::open(&vault_path) {
            Ok(db) => {
                let db = Arc::new(db);
                self.queue.set_db(db.clone());
                self.db = Some(db);
            }
            Err(e) => {
                self.emit_log("error", &format!("Sync database error: {}", e));
                self.emit_file_event("", &format!("db-error: {}", e));
                self.set_state(SyncEngineState::Idle);
                return;
            }
        }

        match crypto::load_vek(&vault_id) {
            Ok(Some(vek)) => self.vek = Some(vek),
            Ok(None) => {
                self.emit_log("warn", "Vault encryption key required");
                let _ = self.app.emit("sync-vek-required", ());
                self.set_state(SyncEngineState::Idle);
                return;
            }
            Err(e) => {
                self.emit_log("error", &format!("Vault encryption key error: {}", e));
                self.emit_file_event("", &format!("vek-error: {}", e));
                self.set_state(SyncEngineState::Idle);
                return;
            }
        }

        if let Some(ref db) = self.db {
            self.last_event_id = db.get_metadata("last_event_id").unwrap_or(None);
        }

        if let Ok(loaded) = self.queue.load_from_db() {
            if loaded > 0 {
                self.emit_file_event("", &format!("resumed {} queued ops", loaded));
            }
        }

        self.vault_id = Some(vault_id);
        self.vault_path = Some(vault_path);
        self.server_url = Some(server_url);

        let initial_ok = match self.run_initial_sync().await {
            Ok(()) => true,
            Err(error) if is_subscription_access_error(&error) => {
                self.handle_access_denied(
                    &subscription_access_message(subscription_code_from_text(&error)),
                    "subscription",
                    subscription_code_from_text(&error),
                );
                return;
            }
            Err(error) => {
                self.emit_log("error", &format!("Initial sync failed: {}", error));
                self.emit_file_event("", &format!("initial-sync-error: {}", error));
                false
            }
        };
        if initial_ok {
            self.enqueue_incomplete_creation_metadata();
        }
        let sse_started = self.start_sse_listener();
        if initial_ok && sse_started {
            self.set_state(SyncEngineState::Live);
        } else {
            self.connection_mode = ConnectionMode::Polling;
            self.set_state(SyncEngineState::Offline);
        }
    }

    fn reset_engine(&mut self) {
        if let Some(cancel) = self.sse_cancel.take() {
            cancel.cancel();
        }
        if let Some(db) = &self.db {
            let _ = db.remove_queue_ops_by_type("lookup_creation_metadata");
        }
        self.vault_id = None;
        self.vault_path = None;
        self.server_url = None;
        self.db = None;
        self.vek = None;
        self.pending_uploads.clear();
        self.pending_deletes.clear();
        self.connection_mode = ConnectionMode::Disconnected;
        self.last_event_id = None;
        self.processed_remote_event_ids.clear();
        self.queue = SyncQueue::new();
    }

    fn handle_stop(&mut self) {
        self.reset_engine();
        self.set_state(SyncEngineState::Idle);
    }

    async fn validate_subscription(&self, client: &SyncHttpClient) -> Result<(), String> {
        let response = client.get("/subscription/v1/status").await?;
        if response.status().as_u16() == 404 {
            return Ok(());
        }

        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            if status.as_u16() == 402 || is_subscription_access_error(&body) {
                return Err(subscription_access_message(subscription_code_from_text(
                    &body,
                )));
            }
            return Err(format!(
                "Subscription status failed: HTTP {}: {}",
                status, body
            ));
        }

        let parsed: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        if parsed["entitled"].as_bool().unwrap_or(false) {
            return Ok(());
        }

        let status_value = parsed["status"].as_str().unwrap_or("none");
        let code = if status_value == "expired" || status_value == "cancelled" {
            Some("subscription_expired")
        } else {
            Some("subscription_required")
        };
        Err(subscription_access_message(code))
    }

    fn handle_access_denied(&mut self, reason: &str, kind: &str, code: Option<&str>) {
        let _ = self.app.emit(
            "sync-vault-access-denied",
            serde_json::json!({
                "reason": reason,
                "kind": kind,
                "code": code,
            }),
        );
        self.reset_engine();
        self.set_state(SyncEngineState::Denied);
    }

    fn handle_update_sync_preferences(
        &mut self,
        sync_settings: bool,
        sync_hotkeys: bool,
        sync_workspace: bool,
        sync_plugin_metadata: bool,
        sync_theme_metadata: bool,
        sync_bookmarks: bool,
        ignore_images: bool,
        excluded_paths: Vec<String>,
    ) {
        let old = self.sync_preferences.clone();
        self.sync_preferences = SyncPreferences {
            sync_settings,
            sync_hotkeys,
            sync_workspace,
            sync_plugin_metadata,
            sync_theme_metadata,
            sync_bookmarks,
            ignore_images,
            excluded_paths,
        };
        let sync_preferences = self.sync_preferences.clone();
        self.pending_uploads
            .retain(|path, _| !should_ignore(path, &sync_preferences));
        self.pending_deletes
            .retain(|path, _| !should_ignore(path, &sync_preferences));

        if self.vault_path.is_none() {
            return;
        }

        let newly_enabled: Vec<&str> = vec![
            (!old.sync_settings && sync_settings).then_some(".cortex/app.json"),
            (!old.sync_hotkeys && sync_hotkeys).then_some(".cortex/hotkeys.json"),
            (!old.sync_workspace && sync_workspace).then_some(".cortex/workspace.json"),
            (!old.sync_plugin_metadata && sync_plugin_metadata)
                .then_some(".cortex/sync-plugins.json"),
            (!old.sync_theme_metadata && sync_theme_metadata).then_some(".cortex/sync-themes.json"),
            (!old.sync_bookmarks && sync_bookmarks).then_some(".cortex/bookmarks.json"),
        ]
        .into_iter()
        .flatten()
        .collect();

        for file_path in newly_enabled {
            let (op, priority) = SyncQueue::upload(file_path.to_string());
            self.queue.push(op, priority);
        }
    }

    async fn handle_sse_connected(&mut self) {
        self.connection_mode = ConnectionMode::Sse;

        if self.state == SyncEngineState::Offline {
            self.set_state(SyncEngineState::Recovering);
            self.handle_reconcile().await;
            self.set_state(SyncEngineState::Live);
        } else {
            self.set_state(SyncEngineState::Live);
        }
    }

    fn handle_sse_disconnected(&mut self, _last_event_id: Option<String>) {
        self.connection_mode = ConnectionMode::Polling;
        self.set_state(SyncEngineState::Offline);
    }

    async fn handle_reconcile(&mut self) {
        let (Some(ref db), Some(ref vek), Some(ref vault_id), Some(ref vault_path)) =
            (&self.db, &self.vek, &self.vault_id, &self.vault_path)
        else {
            return;
        };

        let client_state = match self.app.try_state::<SyncHttpClient>() {
            Some(c) => c,
            None => return,
        };
        let client = &*client_state;

        let reconciler = Reconciler::new(
            &self.app,
            client,
            db,
            vault_id,
            vault_path,
            vek,
            &self.sync_preferences,
        );
        let reconciled = match reconciler.run(self.last_event_id.as_deref()).await {
            Ok(Some(new_event_id)) => {
                self.last_event_id = Some(new_event_id.clone());
                if let Some(ref db) = self.db {
                    let _ = db.set_metadata("last_event_id", &new_event_id);
                }
                true
            }
            Ok(None) => true,
            Err(e) => {
                self.emit_log("error", &format!("Reconciliation failed: {}", e));
                self.emit_file_event("", &format!("reconcile-error: {}", e));
                false
            }
        };
        if reconciled {
            self.enqueue_incomplete_creation_metadata();
        }
    }

    fn enqueue_incomplete_creation_metadata(&mut self) {
        let Some(ref db) = self.db else {
            return;
        };
        let Ok(paths) = db.list_incomplete_creation_metadata() else {
            return;
        };
        for path in paths {
            let (operation, priority) = SyncQueue::lookup_creation_metadata(path);
            self.queue.push(operation, priority);
        }
    }

    async fn handle_poll_tick(&mut self) {
        let (Some(_), Some(_), Some(ref vault_id), Some(_)) =
            (&self.db, &self.vek, &self.vault_id, &self.vault_path)
        else {
            return;
        };

        let client_state = match self.app.try_state::<SyncHttpClient>() {
            Some(c) => c,
            None => return,
        };
        let client = &*client_state;

        let since = self.last_event_id.as_deref().unwrap_or("0");
        let api_path = format!(
            "/sync/v1/vaults/{}/changes?since={}&limit=50",
            vault_id, since
        );

        let response = match client.get(&api_path).await {
            Ok(r) => r,
            Err(_) => return,
        };

        if response.status().as_u16() == 402 {
            let body = response.text().await.unwrap_or_default();
            self.handle_access_denied(
                &subscription_access_message(subscription_code_from_text(&body)),
                "subscription",
                subscription_code_from_text(&body),
            );
            return;
        }

        if response.status().as_u16() == 403 {
            let body = response.text().await.unwrap_or_default();
            self.handle_access_denied(&format!("HTTP 403: {}", body), "vault", None);
            return;
        }

        if !response.status().is_success() {
            return;
        }

        let own_device_id = crate::device::get_device_id().unwrap_or_default();

        let events: Vec<PollEvent> = match response.json().await {
            Ok(e) => e,
            Err(_) => return,
        };

        for event in &events {
            let planned_event = plan_poll_event(event, &own_device_id, &self.sync_preferences);
            if let Some((path, metadata)) = planned_event.note_metadata {
                if let Some(db) = &self.db {
                    let _ = db.upsert_note_metadata(&path, &metadata);
                }
            }
            if let Some((op, priority, event_id)) = planned_event.queue_item {
                if let Err(error) = self.queue.push_from_event(op, priority, event_id) {
                    self.emit_log("warn", &format!("Skipping queued remote event: {}", error));
                }
            }
            if let Some(event_id) = planned_event.processed_event_id {
                self.mark_event_processed(&event_id);
            }
        }
    }

    fn flush_pending_uploads(&mut self) {
        let now = Instant::now();
        let ready: Vec<String> = self
            .pending_uploads
            .iter()
            .filter(|(_, when)| now.duration_since(**when) >= UPLOAD_DEBOUNCE)
            .map(|(path, _)| path.clone())
            .collect();

        for path in ready {
            self.pending_uploads.remove(&path);

            if should_ignore(&path, &self.sync_preferences) {
                continue;
            }

            if let Some(ref vault_path) = self.vault_path {
                let full_path = std::path::Path::new(vault_path).join(&path);
                if !full_path.exists() {
                    continue;
                }
            }

            let (op, priority) = SyncQueue::upload(path);
            self.queue.push(op, priority);
        }
    }

    fn to_relative_path(&self, absolute_path: &str) -> String {
        if let Some(ref vault_path) = self.vault_path {
            return to_vault_relative_path(vault_path, absolute_path);
        }
        absolute_path.replace('\\', "/")
    }

    fn start_sse_listener(&mut self) -> bool {
        let Some(ref vault_id) = self.vault_id else {
            return false;
        };
        let Some(ref server_url) = self.server_url else {
            return false;
        };

        let device_id = match crate::device::get_device_id() {
            Ok(id) => id,
            Err(_) => return false,
        };

        match crate::sync::http::get_access_token_for_server(server_url) {
            Ok(Some(_)) => {}
            _ => return false,
        }

        let url = format!("{}/sync/v1/vaults/{}/events", server_url, vault_id);

        let tx = match self.app.try_state::<mpsc::Sender<SyncCommand>>() {
            Some(s) => (*s).clone(),
            None => return false,
        };

        if let Some(cancel) = self.sse_cancel.take() {
            cancel.cancel();
        }

        let cancel = CancellationToken::new();
        self.sse_cancel = Some(cancel.clone());

        let saved_last_event_id = self.last_event_id.clone();
        let device_id_clone = device_id.clone();
        let server_url_clone = server_url.clone();

        tokio::spawn(async move {
            let mut sse = SseClient::new(tx, device_id_clone.clone(), saved_last_event_id);
            let _ = sse
                .connect(&url, &server_url_clone, &device_id_clone, cancel)
                .await;
        });

        true
    }

    async fn run_initial_sync(&self) -> Result<(), String> {
        let (Some(ref db), Some(ref vek), Some(ref vault_id), Some(ref vault_path)) =
            (&self.db, &self.vek, &self.vault_id, &self.vault_path)
        else {
            return Err("Sync engine is not ready".to_string());
        };

        let client_state = match self.app.try_state::<SyncHttpClient>() {
            Some(c) => c,
            None => return Err("No HTTP client".to_string()),
        };
        let client = &*client_state;

        self.emit_log(
            "info",
            &format!("Initial sync starting for vault {}", vault_id),
        );
        let initial = InitialSync::new(
            &self.app,
            client,
            db,
            vault_id,
            vault_path,
            vek,
            &self.sync_preferences,
        );
        match initial.run().await {
            Ok(()) => {
                self.emit_log("info", "Initial sync completed successfully");
                Ok(())
            }
            Err(e) => Err(e),
        }
    }

    async fn process_next_queue_item(&mut self) -> bool {
        let (Some(db), Some(vek), Some(vault_id), Some(vault_path)) = (
            self.db.clone(),
            self.vek,
            self.vault_id.clone(),
            self.vault_path.clone(),
        ) else {
            return false;
        };
        let db = db.as_ref();
        let vek = &vek;
        let vault_id = vault_id.as_str();
        let vault_path = vault_path.as_str();

        let client_state = match self.app.try_state::<SyncHttpClient>() {
            Some(c) => c,
            None => return false,
        };
        let client = &*client_state;

        let mut pulse_budget = QueuePulseBudget::single_item();
        let Some(item) = pulse_budget.pop_next(&mut self.queue) else {
            return false;
        };

        let creation_lookup_path = match &item.op {
            SyncOp::LookupCreationMetadata { path } => Some(path.clone()),
            _ => None,
        };
        if self.should_ignore_queue_item(&item.op) {
            if let Err(error) = complete_queue_item_and_advance_cursor(
                &self.queue,
                &mut self.last_event_id,
                &mut self.processed_remote_event_ids,
                Some(db),
                &item,
            ) {
                eprintln!("Skipping sync cursor advancement: {}", error);
            }
            return true;
        }

        let result: Result<(), String> = match &item.op {
            SyncOp::Upload { ref path } => {
                self.emit_file_event(path, "uploading");
                let uploader = Uploader::new(client, db, vault_id, vault_path, vek);
                match uploader.upload_file(path).await {
                    Ok(()) => {
                        self.emit_log("info", &format!("Pushed: {}", path));
                        self.emit_file_event(path, "synced");
                        Ok(())
                    }
                    Err(e) => {
                        self.emit_file_event(path, &format!("error: {}", e));
                        Err(e)
                    }
                }
            }
            SyncOp::Download {
                ref path,
                version: _,
            } => {
                self.emit_file_event(path, "downloading");
                let downloader = Downloader::new(client, db, vault_id, vault_path, vek);
                match downloader.download_file(path).await {
                    Ok(DownloadResult::Synced) => {
                        self.emit_log("info", &format!("Pulled: {}", path));
                        self.emit_file_event(path, "synced");
                        Ok(())
                    }
                    Ok(DownloadResult::Merged) => {
                        self.emit_log("info", &format!("Merged: {}", path));
                        self.emit_file_event(path, "merged");
                        Ok(())
                    }
                    Ok(DownloadResult::Conflict { .. }) => {
                        self.emit_file_event(path, "conflict");
                        self.emit_log("warn", &format!("Conflict detected: {}", path));
                        let _ = self
                            .app
                            .emit("sync-conflict", serde_json::json!({ "path": path }));
                        Ok(())
                    }
                    Err(e) => {
                        self.emit_file_event(path, &format!("error: {}", e));
                        Err(e)
                    }
                }
            }
            SyncOp::Delete { ref path } => {
                self.emit_file_event(path, "deleting");
                let downloader = Downloader::new(client, db, vault_id, vault_path, vek);
                match downloader.delete_local_file(path).await {
                    Ok(()) => {
                        self.emit_log("info", &format!("Deleted locally: {}", path));
                        self.emit_file_event(path, "deleted");
                        Ok(())
                    }
                    Err(e) => {
                        self.emit_file_event(path, &format!("error: {}", e));
                        Err(e)
                    }
                }
            }
            SyncOp::DeleteRemote { ref path } => {
                self.emit_file_event(path, "deleting-remote");
                let uploader = Uploader::new(client, db, vault_id, vault_path, vek);
                match uploader.delete_remote_file(path).await {
                    Ok(()) => {
                        self.emit_log("info", &format!("Deleted remote: {}", path));
                        self.emit_file_event(path, "deleted");
                        Ok(())
                    }
                    Err(e) => {
                        self.emit_file_event(path, &format!("error: {}", e));
                        Err(e)
                    }
                }
            }
            SyncOp::Rename {
                ref old_path,
                ref new_path,
            } => {
                self.emit_file_event(old_path, "renaming");
                let downloader = Downloader::new(client, db, vault_id, vault_path, vek);
                match downloader.rename_local_file(old_path, new_path).await {
                    Ok(()) => {
                        self.emit_file_event(new_path, "synced");
                        Ok(())
                    }
                    Err(e) => {
                        self.emit_file_event(old_path, &format!("error: {}", e));
                        Err(e)
                    }
                }
            }
            SyncOp::RenameRemote {
                ref old_path,
                ref new_path,
            } => {
                self.emit_file_event(old_path, "renaming-remote");
                let uploader = Uploader::new(client, db, vault_id, vault_path, vek);
                match uploader.rename_remote_file(old_path, new_path).await {
                    Ok(()) => {
                        self.emit_file_event(new_path, "synced");
                        Ok(())
                    }
                    Err(e) => {
                        self.emit_file_event(old_path, &format!("error: {}", e));
                        Err(e)
                    }
                }
            }
            SyncOp::ResolveConflict {
                ref path,
                ref resolution,
            } => {
                if let Some(ref res) = resolution {
                    self.emit_file_event(path, "resolving");
                    let resolver = ConflictResolver::new(client, db, vault_id, vault_path, vek);
                    match resolver.apply_resolution(path, res).await {
                        Ok(()) => {
                            self.emit_file_event(path, "synced");
                            Ok(())
                        }
                        Err(e) => {
                            self.emit_file_event(path, &format!("error: {}", e));
                            Err(e)
                        }
                    }
                } else {
                    Ok(())
                }
            }
            SyncOp::LookupCreationMetadata { ref path } => {
                let downloader = Downloader::new(client, db, vault_id, vault_path, vek);
                match downloader.get_version_history(path).await {
                    Ok(mut versions) => {
                        versions.sort_by_key(|version| version.version);
                        let first = versions.first();
                        db.upsert_note_metadata(
                            path,
                            &NoteSyncMetadata {
                                created_at: first.and_then(|version| version.created_at.clone()),
                                created_by: first.and_then(|version| version.author_id.clone()),
                                last_edited_at: None,
                                last_edited_by: None,
                                last_device_id: None,
                                synced: true,
                                creation_lookup_complete: true,
                            },
                        )
                    }
                    Err(error) if error.contains("HTTP 404") => complete_creation_lookup(db, path),
                    Err(error) => Err(error),
                }
            }
            SyncOp::InitialSync => Ok(()),
            SyncOp::Reconcile => Ok(()),
        };

        match result {
            Ok(()) => {
                if let Err(error) = complete_queue_item_and_advance_cursor(
                    &self.queue,
                    &mut self.last_event_id,
                    &mut self.processed_remote_event_ids,
                    Some(db),
                    &item,
                ) {
                    eprintln!("Skipping sync cursor advancement: {}", error);
                }
            }
            Err(ref e) if is_subscription_access_error(e) => {
                self.emit_log("error", &format!("Sync plan validation failed: {}", e));
                self.handle_access_denied(
                    &subscription_access_message(subscription_code_from_text(e)),
                    "subscription",
                    subscription_code_from_text(e),
                );
            }
            Err(ref e) => {
                self.emit_log("error", &format!("Sync operation failed: {}", e));
                let retriable = is_retriable_sync_error_message(e);
                let exhausted = item.retry_count + 1 >= item.max_retries;
                if let Some(path) = creation_lookup_path.as_deref() {
                    if !retriable || exhausted {
                        let _ = complete_creation_lookup(db, path);
                    }
                }
                self.queue.mark_failed(item, e, retriable);
            }
        }

        true
    }

    fn should_ignore_queue_item(&self, op: &SyncOp) -> bool {
        match op {
            SyncOp::Upload { path }
            | SyncOp::Download { path, .. }
            | SyncOp::Delete { path }
            | SyncOp::DeleteRemote { path }
            | SyncOp::ResolveConflict { path, .. }
            | SyncOp::LookupCreationMetadata { path } => {
                should_ignore(path, &self.sync_preferences)
            }
            SyncOp::Rename { new_path, .. } | SyncOp::RenameRemote { new_path, .. } => {
                should_ignore(new_path, &self.sync_preferences)
            }
            SyncOp::InitialSync | SyncOp::Reconcile => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::db::{QueueRow, SyncState};
    use std::collections::BTreeSet;
    use uuid::Uuid;

    fn poll_event(id: i64, event_type: &str, file_path: &str, device_id: &str) -> PollEvent {
        PollEvent {
            id,
            event_type: event_type.to_string(),
            file_path: file_path.to_string(),
            version: Some(3),
            device_id: device_id.to_string(),
            actor_id: "user-1".to_string(),
            created_at: "2026-06-25T12:00:00Z".to_string(),
            metadata: None,
        }
    }

    fn remote_queue_item(source_event_id: &str) -> QueueItem {
        QueueItem {
            id: "queue-item".to_string(),
            priority: 80,
            op: SyncOp::Download {
                path: "note.md".to_string(),
                version: 1,
            },
            source_event_id: Some(source_event_id.to_string()),
            retry_count: 0,
            max_retries: 10,
        }
    }

    fn insert_queued_source_event(
        db: &SyncDb,
        queue_id: &str,
        source_event_id: &str,
        status: &str,
        next_retry_at: Option<i64>,
    ) {
        db.enqueue_op(&QueueRow {
            id: queue_id.to_string(),
            op_type: "download".to_string(),
            path: format!("{queue_id}.md"),
            extra_data: Some("1".to_string()),
            source_event_id: Some(source_event_id.to_string()),
            priority: 80,
            retry_count: 0,
            max_retries: 10,
            created_at: 1,
            next_retry_at,
            last_error: None,
            status: status.to_string(),
        })
        .unwrap();
    }

    #[test]
    fn recognizes_watcher_echoes_from_synced_downloads() {
        let directory = std::env::temp_dir().join(format!("cortex-sync-engine-{}", Uuid::new_v4()));
        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
        db.upsert_sync_state(&SyncState {
            file_path: "note.md".to_string(),
            local_hash: Some("synced-hash".to_string()),
            remote_hash: Some("synced-hash".to_string()),
            ancestor_hash: Some("synced-hash".to_string()),
            local_mtime: None,
            remote_mtime: None,
            sync_status: "synced".to_string(),
            last_synced_at: None,
            server_version_id: None,
        })
        .unwrap();

        assert!(matches_synced_hash(Some(&db), "note.md", "synced-hash"));
        assert!(!matches_synced_hash(Some(&db), "note.md", "local-change"));
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn poll_planner_marks_own_device_events_processed_without_queueing() {
        let event = poll_event(20, "file_updated", "note.md", "own-device");

        let planned = plan_poll_event(&event, "own-device", &SyncPreferences::default());

        assert!(planned.queue_item.is_none());
        assert!(planned.note_metadata.is_none());
        assert_eq!(planned.processed_event_id.as_deref(), Some("20"));
    }

    #[test]
    fn poll_planner_marks_ignored_events_processed_without_queueing() {
        let event = poll_event(21, "file_updated", "ignored.md", "other-device");
        let preferences = SyncPreferences {
            excluded_paths: vec!["ignored.md".to_string()],
            ..SyncPreferences::default()
        };

        let planned = plan_poll_event(&event, "own-device", &preferences);

        assert!(planned.queue_item.is_none());
        assert!(planned.note_metadata.is_none());
        assert_eq!(planned.processed_event_id.as_deref(), Some("21"));
    }

    #[test]
    fn poll_planner_attaches_event_id_to_remote_download() {
        let event = poll_event(22, "file_updated", "note.md", "other-device");

        let planned = plan_poll_event(&event, "own-device", &SyncPreferences::default());

        let (operation, priority, source_event_id) = planned.queue_item.unwrap();
        assert_eq!(priority, 80);
        assert_eq!(source_event_id, "22");
        assert!(matches!(
            operation,
            SyncOp::Download {
                path,
                version: 3
            } if path == "note.md"
        ));
        assert!(planned.processed_event_id.is_none());
    }

    #[test]
    fn poll_planner_marks_unknown_events_processed_without_queueing() {
        let event = poll_event(23, "workspace_snapshot_ready", "note.md", "other-device");

        let planned = plan_poll_event(&event, "own-device", &SyncPreferences::default());

        assert!(planned.queue_item.is_none());
        assert!(planned.note_metadata.is_none());
        assert_eq!(planned.processed_event_id.as_deref(), Some("23"));
    }

    #[test]
    fn queue_pulse_budget_pops_only_one_item() {
        let mut queue = SyncQueue::new();
        queue.push(SyncOp::InitialSync, 20);
        queue.push(SyncOp::Reconcile, 90);
        let mut budget = QueuePulseBudget::single_item();

        assert!(budget.pop_next(&mut queue).is_some());
        assert!(budget.pop_next(&mut queue).is_none());
        assert_eq!(queue.len(), 1);

        let mut next_budget = QueuePulseBudget::single_item();
        assert!(next_budget.pop_next(&mut queue).is_some());
        assert!(queue.is_empty());
    }

    #[test]
    fn completed_queue_item_advances_source_event_cursor() {
        let item = remote_queue_item("30");
        let mut last_event_id = None;
        let mut processed_event_ids = BTreeSet::new();

        let advanced = advance_cursor_for_queue_outcome(
            &mut last_event_id,
            &mut processed_event_ids,
            None,
            &item,
            QueueProcessOutcome::Completed,
        )
        .unwrap();

        assert!(advanced);
        assert_eq!(last_event_id.as_deref(), Some("30"));
    }

    #[test]
    fn failed_queue_item_does_not_advance_source_event_cursor() {
        let item = remote_queue_item("31");
        let mut last_event_id = None;
        let mut processed_event_ids = BTreeSet::new();

        let advanced = advance_cursor_for_queue_outcome(
            &mut last_event_id,
            &mut processed_event_ids,
            None,
            &item,
            QueueProcessOutcome::Failed,
        )
        .unwrap();

        assert!(!advanced);
        assert_eq!(last_event_id, None);
    }

    #[test]
    fn ignored_queue_item_completion_advances_source_event_cursor() {
        let item = remote_queue_item("32");
        let mut last_event_id = Some("31".to_string());
        let mut processed_event_ids = BTreeSet::new();

        let advanced = advance_cursor_for_queue_outcome(
            &mut last_event_id,
            &mut processed_event_ids,
            None,
            &item,
            QueueProcessOutcome::Completed,
        )
        .unwrap();

        assert!(advanced);
        assert_eq!(last_event_id.as_deref(), Some("32"));
    }

    #[test]
    fn cursor_advances_from_none_to_new_event_id() {
        let mut last_event_id = None;
        let mut processed_event_ids = BTreeSet::new();

        let advanced =
            record_processed_event(&mut last_event_id, &mut processed_event_ids, None, "10")
                .unwrap();

        assert!(advanced);
        assert_eq!(last_event_id.as_deref(), Some("10"));
    }

    #[test]
    fn cursor_does_not_move_backward() {
        let mut last_event_id = Some("10".to_string());
        let mut processed_event_ids = BTreeSet::new();

        let advanced =
            record_processed_event(&mut last_event_id, &mut processed_event_ids, None, "9")
                .unwrap();

        assert!(!advanced);
        assert_eq!(last_event_id.as_deref(), Some("10"));
    }

    #[test]
    fn cursor_persists_to_sync_database() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-engine-cursor-{}", Uuid::new_v4()));
        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
        let mut last_event_id = None;
        let mut processed_event_ids = BTreeSet::new();

        let advanced = record_processed_event(
            &mut last_event_id,
            &mut processed_event_ids,
            Some(&db),
            "11",
        )
        .unwrap();

        assert!(advanced);
        assert_eq!(last_event_id.as_deref(), Some("11"));
        assert_eq!(
            db.get_metadata("last_event_id").unwrap().as_deref(),
            Some("11")
        );
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn lower_queued_event_blocks_completed_later_event_cursor_advancement() {
        for (label, status, next_retry_at) in [
            ("pending", "pending", None),
            ("retry-delayed", "pending", Some(i64::MAX)),
            ("dead", "dead", None),
        ] {
            let directory = std::env::temp_dir().join(format!(
                "cortex-sync-engine-blocked-{label}-{}",
                Uuid::new_v4()
            ));
            let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
            insert_queued_source_event(&db, "queued-10", "10", status, next_retry_at);
            let item = remote_queue_item("11");
            let mut last_event_id = Some("9".to_string());
            let mut processed_event_ids = BTreeSet::new();

            let advanced = advance_cursor_for_queue_outcome(
                &mut last_event_id,
                &mut processed_event_ids,
                Some(&db),
                &item,
                QueueProcessOutcome::Completed,
            )
            .unwrap();

            assert!(!advanced, "{label} row should block cursor advancement");
            assert_eq!(last_event_id.as_deref(), Some("9"));
            assert_eq!(db.get_metadata("last_event_id").unwrap(), None);
            drop(db);
            std::fs::remove_dir_all(directory).unwrap();
        }
    }

    #[test]
    fn cursor_advances_to_later_processed_event_after_lower_event_completes() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-engine-unblocked-{}", Uuid::new_v4()));
        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
        insert_queued_source_event(&db, "queued-10", "10", "pending", None);
        let item_11 = remote_queue_item("11");
        let item_10 = remote_queue_item("10");
        let mut last_event_id = Some("9".to_string());
        let mut processed_event_ids = BTreeSet::new();

        let advanced = advance_cursor_for_queue_outcome(
            &mut last_event_id,
            &mut processed_event_ids,
            Some(&db),
            &item_11,
            QueueProcessOutcome::Completed,
        )
        .unwrap();
        assert!(!advanced);
        assert_eq!(last_event_id.as_deref(), Some("9"));

        db.mark_queue_completed("queued-10").unwrap();
        let advanced = advance_cursor_for_queue_outcome(
            &mut last_event_id,
            &mut processed_event_ids,
            Some(&db),
            &item_10,
            QueueProcessOutcome::Completed,
        )
        .unwrap();

        assert!(advanced);
        assert_eq!(last_event_id.as_deref(), Some("11"));
        assert_eq!(
            db.get_metadata("last_event_id").unwrap().as_deref(),
            Some("11")
        );
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn processed_noop_event_obeys_queue_blockers() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-engine-noop-{}", Uuid::new_v4()));
        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
        insert_queued_source_event(&db, "queued-10", "10", "pending", None);
        let mut last_event_id = Some("9".to_string());
        let mut processed_event_ids = BTreeSet::new();

        let advanced = record_processed_event(
            &mut last_event_id,
            &mut processed_event_ids,
            Some(&db),
            "11",
        )
        .unwrap();
        assert!(!advanced);
        assert_eq!(last_event_id.as_deref(), Some("9"));

        db.mark_queue_completed("queued-10").unwrap();
        let advanced = record_processed_event(
            &mut last_event_id,
            &mut processed_event_ids,
            Some(&db),
            "10",
        )
        .unwrap();

        assert!(advanced);
        assert_eq!(last_event_id.as_deref(), Some("11"));
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
