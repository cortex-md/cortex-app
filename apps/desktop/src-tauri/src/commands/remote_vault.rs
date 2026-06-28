use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

use crate::sync::http::{parse_response, SyncHttpClient};

#[derive(Deserialize)]
struct RemoteVaultResponse {
    id: String,
    name: String,
    description: Option<String>,
    owner_id: String,
    role: String,
    #[serde(default)]
    member_count: u32,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteVault {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub role: String,
    pub member_count: u32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<RemoteVaultResponse> for RemoteVault {
    fn from(r: RemoteVaultResponse) -> Self {
        Self {
            id: r.id,
            name: r.name,
            description: r.description,
            owner_id: r.owner_id,
            role: r.role,
            member_count: r.member_count,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Serialize)]
struct CreateVaultRequest {
    name: String,
    description: Option<String>,
    encrypted_vault_key: String,
}

#[derive(Serialize)]
struct UpdateVaultRequest {
    name: Option<String>,
    description: Option<String>,
}

#[tauri::command]
pub async fn remote_vault_create(
    client: State<'_, SyncHttpClient>,
    name: String,
    description: Option<String>,
) -> Result<RemoteVault, String> {
    let vek = crate::sync::crypto::generate_vek();
    let encoded_key = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, vek);
    let body = CreateVaultRequest {
        name,
        description,
        encrypted_vault_key: encoded_key,
    };
    let response = client.post_json("/vaults/v1/", &body).await?;
    let raw: RemoteVaultResponse = parse_response(response).await?;
    let vault = RemoteVault::from(raw);
    crate::sync::crypto::store_vek(&vault.id, &vek)?;
    Ok(vault)
}

#[tauri::command]
pub async fn remote_vault_list(
    client: State<'_, SyncHttpClient>,
) -> Result<Vec<RemoteVault>, String> {
    let response = client.get("/vaults/v1/").await?;
    let raw: Vec<RemoteVaultResponse> = parse_response(response).await?;
    Ok(raw.into_iter().map(RemoteVault::from).collect())
}

#[tauri::command]
pub async fn remote_vault_get(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
) -> Result<RemoteVault, String> {
    let response = client.get(&format!("/vaults/v1/{}/", vault_id)).await?;
    let raw: RemoteVaultResponse = parse_response(response).await?;
    Ok(RemoteVault::from(raw))
}

#[tauri::command]
pub async fn remote_vault_update(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<RemoteVault, String> {
    let body = UpdateVaultRequest { name, description };
    let response = client
        .patch_json(&format!("/vaults/v1/{}/", vault_id), &body)
        .await?;
    let raw: RemoteVaultResponse = parse_response(response).await?;
    Ok(RemoteVault::from(raw))
}

#[tauri::command]
pub async fn remote_vault_delete(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
) -> Result<(), String> {
    let response = client.delete(&format!("/vaults/v1/{}/", vault_id)).await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }
    Ok(())
}

fn read_sync_config(vault_path: &str) -> serde_json::Value {
    let config_path = std::path::Path::new(vault_path)
        .join(".cortex")
        .join("sync-config.json");
    if !config_path.exists() {
        return serde_json::json!({});
    }
    std::fs::read_to_string(&config_path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_sync_config(vault_path: &str, config: &serde_json::Value) -> Result<(), String> {
    let config_dir = std::path::Path::new(vault_path).join(".cortex");
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_path = config_dir.join("sync-config.json");
    std::fs::write(&config_path, serde_json::to_string_pretty(config).unwrap())
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    pub enabled: bool,
    pub remote_vault_id: Option<String>,
    pub self_hosted: bool,
    pub server_url: Option<String>,
    pub offline_mode: bool,
    pub self_hosted_environment: HashMap<String, String>,
}

#[tauri::command]
pub fn remote_vault_link(vault_path: String, remote_vault_id: String) -> Result<(), String> {
    let mut config = read_sync_config(&vault_path);
    config["remoteVaultId"] = serde_json::json!(remote_vault_id);
    write_sync_config(&vault_path, &config)
}

#[tauri::command]
pub fn remote_vault_unlink(vault_path: String) -> Result<(), String> {
    let mut config = read_sync_config(&vault_path);
    config.as_object_mut().map(|o| o.remove("remoteVaultId"));
    write_sync_config(&vault_path, &config)
}

#[tauri::command]
pub fn remote_vault_get_link(vault_path: String) -> Result<Option<String>, String> {
    let config = read_sync_config(&vault_path);
    Ok(config["remoteVaultId"].as_str().map(|s| s.to_string()))
}

#[tauri::command]
pub fn sync_config_read(vault_path: String) -> Result<SyncConfig, String> {
    let config = read_sync_config(&vault_path);
    Ok(SyncConfig {
        enabled: config["enabled"].as_bool().unwrap_or(false),
        remote_vault_id: config["remoteVaultId"].as_str().map(|s| s.to_string()),
        self_hosted: config["selfHosted"].as_bool().unwrap_or(false),
        server_url: config["serverUrl"].as_str().map(|s| s.to_string()),
        offline_mode: config["offlineMode"].as_bool().unwrap_or(false),
        self_hosted_environment: serde_json::from_value(config["selfHostedEnvironment"].clone())
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub fn sync_config_update(
    vault_path: String,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let mut config = read_sync_config(&vault_path);
    config[key] = value;
    write_sync_config(&vault_path, &config)
}
