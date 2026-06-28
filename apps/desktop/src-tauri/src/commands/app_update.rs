use reqwest::header::{ACCEPT, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const UPDATE_ENDPOINT: &str =
    "https://github.com/cortex-md/cortex-app/releases/latest/download/latest.json";
const GITHUB_RELEASE_API_PREFIX: &str =
    "https://api.github.com/repos/cortex-md/cortex-app/releases/tags";
const UPDATE_REQUEST_TIMEOUT_SECONDS: u64 = 20;
const GITHUB_API_VERSION: &str = "2022-11-28";
const GITHUB_USER_AGENT: &str = "Cortex desktop updater";

#[derive(Debug, thiserror::Error)]
pub enum AppUpdateError {
    #[error(transparent)]
    Updater(#[from] tauri_plugin_updater::Error),
    #[error("updater public key is not configured")]
    MissingPublicKey,
    #[error("there is no pending update")]
    NoPendingUpdate,
}

impl Serialize for AppUpdateError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

type Result<T> = std::result::Result<T, AppUpdateError>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateMetadata {
    version: String,
    current_version: String,
    body: Option<String>,
    date: Option<String>,
    target: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AppUpdateState {
    Idle,
    Checking,
    UpToDate,
    Available,
    Installing,
    Installed,
    Error,
    Unsupported,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateStatus {
    state: AppUpdateState,
    current_version: Option<String>,
    pending_update: Option<AppUpdateMetadata>,
    last_checked_at: Option<String>,
    last_error: Option<String>,
    downloaded: u64,
    content_length: Option<u64>,
}

#[derive(Deserialize)]
struct GitHubRelease {
    body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum AppUpdateInstallEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
        downloaded: u64,
        content_length: Option<u64>,
    },
    Finished,
}

#[derive(Default)]
pub struct AppUpdateManager {
    state: Mutex<AppUpdateRuntimeState>,
}

struct AppUpdateRuntimeState {
    state: AppUpdateState,
    current_version: Option<String>,
    pending_update: Option<Update>,
    pending_metadata: Option<AppUpdateMetadata>,
    last_checked_at: Option<String>,
    last_error: Option<String>,
    downloaded: u64,
    content_length: Option<u64>,
}

impl Default for AppUpdateRuntimeState {
    fn default() -> Self {
        Self {
            state: AppUpdateState::Idle,
            current_version: None,
            pending_update: None,
            pending_metadata: None,
            last_checked_at: None,
            last_error: None,
            downloaded: 0,
            content_length: None,
        }
    }
}

impl AppUpdateManager {
    fn status(&self) -> AppUpdateStatus {
        self.state
            .lock()
            .expect("app update state poisoned")
            .status()
    }

    fn set_current_version(&self, current_version: String) {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.current_version = Some(current_version);
    }

    fn mark_checking(&self) {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.state = AppUpdateState::Checking;
        state.last_error = None;
        state.downloaded = 0;
        state.content_length = None;
    }

    fn mark_unsupported(&self, error: AppUpdateError) -> AppUpdateStatus {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.state = AppUpdateState::Unsupported;
        state.last_error = Some(error.to_string());
        state.status()
    }

    fn mark_check_error(&self, error: &AppUpdateError) -> AppUpdateStatus {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.state = AppUpdateState::Error;
        state.last_checked_at = Some(now_iso8601());
        state.last_error = Some(error.to_string());
        state.status()
    }

    fn store_check_result(
        &self,
        current_version: String,
        update: Option<Update>,
    ) -> AppUpdateStatus {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.last_checked_at = Some(now_iso8601());
        state.last_error = None;
        state.downloaded = 0;
        state.content_length = None;
        state.pending_metadata = update.as_ref().map(update_metadata);
        state.current_version = Some(current_version);
        state.pending_update = update;
        state.state = if state.pending_update.is_some() {
            AppUpdateState::Available
        } else {
            AppUpdateState::UpToDate
        };
        state.status()
    }

    fn pending_update(&self) -> Result<Update> {
        let state = self.state.lock().expect("app update state poisoned");
        state
            .pending_update
            .clone()
            .ok_or(AppUpdateError::NoPendingUpdate)
    }

    fn mark_installing(&self) {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.state = AppUpdateState::Installing;
        state.last_error = None;
        state.downloaded = 0;
        state.content_length = None;
    }

    fn mark_progress(&self, downloaded: u64, content_length: Option<u64>) {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.downloaded = downloaded;
        state.content_length = content_length;
    }

    fn mark_installed(&self) -> AppUpdateStatus {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.state = AppUpdateState::Installed;
        state.pending_update = None;
        state.pending_metadata = None;
        state.last_error = None;
        state.status()
    }

    fn mark_install_error(&self, error: &AppUpdateError) -> AppUpdateStatus {
        let mut state = self.state.lock().expect("app update state poisoned");
        state.state = AppUpdateState::Error;
        state.last_error = Some(error.to_string());
        state.status()
    }
}

impl AppUpdateRuntimeState {
    fn status(&self) -> AppUpdateStatus {
        AppUpdateStatus {
            state: self.state.clone(),
            current_version: self.current_version.clone(),
            pending_update: self.pending_metadata.clone(),
            last_checked_at: self.last_checked_at.clone(),
            last_error: self.last_error.clone(),
            downloaded: self.downloaded,
            content_length: self.content_length,
        }
    }
}

pub fn init(app: &mut tauri::App) {
    app.manage(AppUpdateManager::default());
}

#[tauri::command]
pub async fn app_update_status(
    app: AppHandle,
    manager: State<'_, AppUpdateManager>,
) -> Result<AppUpdateStatus> {
    manager.set_current_version(app.package_info().version.to_string());
    Ok(manager.status())
}

#[tauri::command]
pub async fn app_update_check(
    app: AppHandle,
    manager: State<'_, AppUpdateManager>,
    source: String,
) -> Result<AppUpdateStatus> {
    let _ = source;
    let current_version = app.package_info().version.to_string();
    manager.set_current_version(current_version.clone());
    let Some(public_key) = updater_public_key() else {
        return Ok(manager.mark_unsupported(AppUpdateError::MissingPublicKey));
    };

    manager.mark_checking();
    let endpoint = url::Url::parse(UPDATE_ENDPOINT).expect("invalid update endpoint");
    let update_result = app
        .updater_builder()
        .pubkey(public_key)
        .endpoints(vec![endpoint])?
        .timeout(Duration::from_secs(UPDATE_REQUEST_TIMEOUT_SECONDS))
        .build()?
        .check()
        .await;

    match update_result {
        Ok(update) => Ok(manager.store_check_result(current_version, update)),
        Err(error) => {
            let error = AppUpdateError::Updater(error);
            Ok(manager.mark_check_error(&error))
        }
    }
}

#[tauri::command]
pub async fn app_update_install(
    app: AppHandle,
    manager: State<'_, AppUpdateManager>,
    on_event: Channel<AppUpdateInstallEvent>,
) -> Result<AppUpdateStatus> {
    let update = match manager.pending_update() {
        Ok(update) => update,
        Err(error) => {
            manager.mark_install_error(&error);
            return Err(error);
        }
    };
    manager.mark_installing();

    let mut downloaded = 0_u64;
    let mut content_length = None;
    let mut started = false;
    let result = update
        .download_and_install(
            |chunk_length, next_content_length| {
                downloaded += chunk_length as u64;
                content_length = next_content_length;
                if !started {
                    started = true;
                    let _ = on_event.send(AppUpdateInstallEvent::Started { content_length });
                }
                manager.mark_progress(downloaded, content_length);
                let _ = on_event.send(AppUpdateInstallEvent::Progress {
                    chunk_length,
                    downloaded,
                    content_length,
                });
            },
            || {
                let _ = on_event.send(AppUpdateInstallEvent::Finished);
            },
        )
        .await;

    match result {
        Ok(()) => {
            let status = manager.mark_installed();
            app.request_restart();
            Ok(status)
        }
        Err(error) => {
            let error = AppUpdateError::Updater(error);
            Ok(manager.mark_install_error(&error))
        }
    }
}

#[tauri::command]
pub async fn app_update_fetch_changelog(version: String) -> Option<String> {
    let normalized_version = version.trim().trim_start_matches('v');
    if normalized_version.is_empty() {
        return None;
    }

    let url = format!("{GITHUB_RELEASE_API_PREFIX}/v{normalized_version}");
    fetch_release_body_from_url(&reqwest::Client::new(), &url).await
}

async fn fetch_release_body_from_url(client: &reqwest::Client, url: &str) -> Option<String> {
    let response = client
        .get(url)
        .header(USER_AGENT, GITHUB_USER_AGENT)
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .timeout(Duration::from_secs(UPDATE_REQUEST_TIMEOUT_SECONDS))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    response
        .json::<GitHubRelease>()
        .await
        .ok()
        .and_then(|release| release.body)
        .map(|body| body.trim().to_string())
        .filter(|body| !body.is_empty())
}

fn updater_public_key() -> Option<String> {
    option_env!("CORTEX_UPDATER_PUBLIC_KEY")
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .map(normalize_updater_public_key)
}

fn normalize_updater_public_key(key: &str) -> String {
    let trimmed = key.trim();
    if is_minisign_public_key(trimmed) {
        return trimmed.to_string();
    }

    use base64::{engine::general_purpose::STANDARD, Engine};

    STANDARD
        .decode(trimmed)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .map(|decoded| decoded.trim().to_string())
        .filter(|decoded| is_minisign_public_key(decoded))
        .unwrap_or_else(|| trimmed.to_string())
}

fn is_minisign_public_key(key: &str) -> bool {
    key.lines()
        .any(|line| line.starts_with("untrusted comment: minisign public key:"))
}

fn update_metadata(update: &Update) -> AppUpdateMetadata {
    AppUpdateMetadata {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        body: update.body.clone(),
        date: update.date.map(|date| date.to_string()),
        target: Some(update.target.clone()),
    }
}

fn now_iso8601() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        fetch_release_body_from_url, normalize_updater_public_key, AppUpdateError,
        AppUpdateManager, AppUpdateState,
    };
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[test]
    fn status_starts_idle_without_pending_update() {
        let manager = AppUpdateManager::default();
        let status = manager.status();

        assert!(matches!(status.state, AppUpdateState::Idle));
        assert!(status.pending_update.is_none());
        assert!(status.last_error.is_none());
    }

    #[test]
    fn check_without_update_marks_up_to_date() {
        let manager = AppUpdateManager::default();
        let status = manager.store_check_result("0.1.0".to_string(), None);

        assert!(matches!(status.state, AppUpdateState::UpToDate));
        assert_eq!(status.current_version.as_deref(), Some("0.1.0"));
        assert!(status.pending_update.is_none());
        assert!(status.last_checked_at.is_some());
        assert!(status.last_error.is_none());
    }

    #[test]
    fn error_serializes_as_user_visible_message() {
        let serialized = serde_json::to_value(AppUpdateError::MissingPublicKey).unwrap();

        assert_eq!(
            serialized,
            serde_json::json!("updater public key is not configured")
        );
    }

    #[test]
    fn update_endpoint_uses_github_latest_release_asset() {
        assert_eq!(
            super::UPDATE_ENDPOINT,
            "https://github.com/cortex-md/cortex-app/releases/latest/download/latest.json"
        );
    }

    #[test]
    fn updater_public_key_preserves_minisign_public_key() {
        let public_key = "untrusted comment: minisign public key: 7B5A90ED1173558\nRWRYNRfRDqm1B5qDK9z6cgHG6GazX3etRZjQv4A8vYR2Q3IXepp9GfVd";

        assert_eq!(normalize_updater_public_key(public_key), public_key);
    }

    #[test]
    fn updater_public_key_decodes_tauri_generated_public_key_file() {
        let encoded = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDdCNUE5MEVEMTE3MzU1OApSV1JZTlJmUkRxbTFCNXFESzl6NmNnSEc2R2F6WDNldFJaalF2NEE4dllSMlEzSVhlcHA5R2ZWZAo=";

        assert_eq!(
            normalize_updater_public_key(encoded),
            "untrusted comment: minisign public key: 7B5A90ED1173558\nRWRYNRfRDqm1B5qDK9z6cgHG6GazX3etRZjQv4A8vYR2Q3IXepp9GfVd"
        );
    }

    #[tokio::test]
    async fn changelog_reads_github_release_body() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/repos/cortex-md/cortex-app/releases/tags/v0.1.0"))
            .and(header("user-agent", super::GITHUB_USER_AGENT))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "body": "# Cortex 0.1.0\n\nInitial stable release."
            })))
            .mount(&server)
            .await;

        let body = fetch_release_body_from_url(
            &reqwest::Client::new(),
            &format!(
                "{}/repos/cortex-md/cortex-app/releases/tags/v0.1.0",
                server.uri()
            ),
        )
        .await;

        assert_eq!(
            body.as_deref(),
            Some("# Cortex 0.1.0\n\nInitial stable release.")
        );
    }
}
