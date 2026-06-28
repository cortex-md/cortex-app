use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncEngineState {
    Idle,
    #[allow(dead_code)]
    Authenticating,
    Connecting,
    #[allow(dead_code)]
    Syncing,
    Live,
    Offline,
    Recovering,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    KeepLocal,
    KeepRemote,
    Merged { content: String },
}

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq)]
pub enum SyncErrorKind {
    Transient,
    Permanent,
    Auth,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct SyncError {
    pub kind: SyncErrorKind,
    pub message: String,
}

#[allow(dead_code)]
impl SyncError {
    pub fn transient(msg: impl Into<String>) -> Self {
        Self {
            kind: SyncErrorKind::Transient,
            message: msg.into(),
        }
    }

    pub fn permanent(msg: impl Into<String>) -> Self {
        Self {
            kind: SyncErrorKind::Permanent,
            message: msg.into(),
        }
    }

    pub fn auth(msg: impl Into<String>) -> Self {
        Self {
            kind: SyncErrorKind::Auth,
            message: msg.into(),
        }
    }

    pub fn from_status(status: u16, body: String) -> Self {
        match status {
            401 | 402 | 403 => Self::auth(format!("HTTP {}: {}", status, body)),
            404 | 422 => Self::permanent(format!("HTTP {}: {}", status, body)),
            409 => Self::permanent(format!("Conflict: HTTP {}: {}", status, body)),
            429 | 500 | 502 | 503 | 504 => Self::transient(format!("HTTP {}: {}", status, body)),
            _ if status >= 400 && status < 500 => {
                Self::permanent(format!("HTTP {}: {}", status, body))
            }
            _ => Self::transient(format!("HTTP {}: {}", status, body)),
        }
    }

    pub fn is_retriable(&self) -> bool {
        self.kind == SyncErrorKind::Transient
    }
}

impl std::fmt::Display for SyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl From<String> for SyncError {
    fn from(msg: String) -> Self {
        Self::transient(msg)
    }
}

pub fn is_retriable_sync_error_message(message: &str) -> bool {
    match http_status_from_message(message) {
        Some(status) => SyncError::from_status(status, String::new()).is_retriable(),
        None => true,
    }
}

fn http_status_from_message(message: &str) -> Option<u16> {
    let mut remaining = message;

    while let Some(index) = remaining.find("HTTP") {
        let after_label = &remaining[index + "HTTP".len()..];
        let after_whitespace = after_label.trim_start_matches(char::is_whitespace);

        if after_whitespace.len() == after_label.len() {
            remaining = after_label;
            continue;
        }

        let digit_count = after_whitespace
            .chars()
            .take_while(|character| character.is_ascii_digit())
            .count();

        if digit_count == 3 {
            return after_whitespace[..digit_count].parse().ok();
        }

        remaining = after_label;
    }

    None
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionMode {
    Sse,
    Polling,
    Disconnected,
}

#[derive(Debug, Clone)]
pub enum SyncCommand {
    Start {
        vault_id: String,
        vault_path: String,
        server_url: String,
        requires_entitlement: bool,
    },
    Stop,
    LocalFileChanged {
        path: String,
    },
    LocalFileDeleted {
        path: String,
    },
    ForceSyncFile {
        path: String,
    },
    RemoteFileChanged {
        path: String,
        version: u64,
        actor_id: String,
        device_id: String,
        edited_at: Option<String>,
        created: bool,
        event_id: Option<String>,
    },
    RemoteFileDeleted {
        path: String,
        event_id: Option<String>,
    },
    RemoteFileRenamed {
        old_path: String,
        new_path: String,
        event_id: Option<String>,
    },
    RemoteEventProcessed {
        event_id: String,
    },
    ResolveConflict {
        path: String,
        resolution: ConflictResolution,
    },
    SseConnected,
    SseDisconnected {
        last_event_id: Option<String>,
    },
    AccessDenied {
        reason: String,
        kind: String,
        code: Option<String>,
    },
    #[allow(dead_code)]
    Reconcile,
    #[allow(dead_code)]
    PollTick,
    UpdateSyncPreferences {
        sync_settings: bool,
        sync_hotkeys: bool,
        sync_workspace: bool,
        sync_plugin_metadata: bool,
        sync_theme_metadata: bool,
        sync_bookmarks: bool,
        ignore_images: bool,
        excluded_paths: Vec<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::is_retriable_sync_error_message;

    #[test]
    fn queue_failure_message_with_http_429_is_retriable() {
        assert!(is_retriable_sync_error_message(
            "Upload failed: HTTP 429: too many requests"
        ));
    }

    #[test]
    fn server_error_sync_error_messages_are_retriable() {
        for status in [500, 502, 503, 504] {
            assert!(is_retriable_sync_error_message(&format!(
                "Sync operation failed: HTTP {}: retry later",
                status
            )));
        }
    }

    #[test]
    fn auth_and_permanent_sync_error_messages_are_not_retriable() {
        for status in [401, 402, 403, 404, 409, 422] {
            assert!(!is_retriable_sync_error_message(&format!(
                "Conflict: HTTP {}: cannot retry",
                status
            )));
        }
    }

    #[test]
    fn sync_error_message_without_http_status_is_retriable() {
        assert!(is_retriable_sync_error_message("network unavailable"));
    }

    #[test]
    fn malformed_http_fragment_is_retriable() {
        assert!(is_retriable_sync_error_message("HTTP unavailable"));
        assert!(is_retriable_sync_error_message("HTTP 42"));
    }
}
