use serde::{Deserialize, Serialize};
use tauri::State;

use crate::sync::http::{parse_response, SyncHttpClient};

#[derive(Deserialize)]
struct DeviceResponse {
    pub id: String,
    pub device_name: String,
    pub device_type: String,
    pub last_seen_at: Option<String>,
    pub created_at: String,
    pub revoked: bool,
    pub is_current: Option<bool>,
    pub last_sync_event_id: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceEntry {
    pub id: String,
    pub device_name: String,
    pub device_type: String,
    pub last_seen_at: Option<String>,
    pub created_at: String,
    pub revoked: bool,
    pub is_current: Option<bool>,
    pub last_sync_event_id: Option<i64>,
}

impl From<DeviceResponse> for DeviceEntry {
    fn from(r: DeviceResponse) -> Self {
        DeviceEntry {
            id: r.id,
            device_name: r.device_name,
            device_type: r.device_type,
            last_seen_at: r.last_seen_at,
            created_at: r.created_at,
            revoked: r.revoked,
            is_current: r.is_current,
            last_sync_event_id: r.last_sync_event_id,
        }
    }
}

#[derive(Serialize)]
struct RenameDeviceRequest {
    device_name: String,
}

#[derive(Serialize)]
struct UpdateSyncCursorRequest {
    last_sync_event_id: i64,
}

#[tauri::command]
pub async fn devices_list(client: State<'_, SyncHttpClient>) -> Result<Vec<DeviceEntry>, String> {
    let response = client.get("/devices/v1/").await?;
    let raw: Vec<DeviceResponse> = parse_response(response).await?;
    Ok(raw.into_iter().map(DeviceEntry::from).collect())
}

#[tauri::command]
pub async fn device_get(
    client: State<'_, SyncHttpClient>,
    device_id: String,
) -> Result<DeviceEntry, String> {
    let response = client.get(&format!("/devices/v1/{}", device_id)).await?;
    let raw: DeviceResponse = parse_response(response).await?;
    Ok(DeviceEntry::from(raw))
}

#[tauri::command]
pub async fn device_rename(
    client: State<'_, SyncHttpClient>,
    device_id: String,
    device_name: String,
) -> Result<DeviceEntry, String> {
    let body = RenameDeviceRequest { device_name };
    let response = client
        .patch_json(&format!("/devices/v1/{}", device_id), &body)
        .await?;
    let raw: DeviceResponse = parse_response(response).await?;
    Ok(DeviceEntry::from(raw))
}

#[tauri::command]
pub async fn device_revoke(
    client: State<'_, SyncHttpClient>,
    device_id: String,
) -> Result<(), String> {
    let response = client.delete(&format!("/devices/v1/{}", device_id)).await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }
    Ok(())
}

#[tauri::command]
pub async fn device_update_sync_cursor(
    client: State<'_, SyncHttpClient>,
    device_id: String,
    last_sync_event_id: i64,
) -> Result<(), String> {
    let body = UpdateSyncCursorRequest { last_sync_event_id };
    let response = client
        .put_json(&format!("/devices/v1/{}/sync-cursor", device_id), &body)
        .await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }
    Ok(())
}
