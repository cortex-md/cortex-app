use serde::{Deserialize, Serialize};
use tauri::State;

use crate::sync::http::{parse_response, SyncHttpClient};

#[derive(Deserialize)]
pub struct VaultMemberResponse {
    pub vault_id: String,
    pub user_id: String,
    pub email: String,
    pub display_name: String,
    pub role: String,
    pub joined_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultMember {
    pub vault_id: String,
    pub user_id: String,
    pub email: String,
    pub display_name: String,
    pub role: String,
    pub joined_at: String,
}

impl From<VaultMemberResponse> for VaultMember {
    fn from(r: VaultMemberResponse) -> Self {
        Self {
            vault_id: r.vault_id,
            user_id: r.user_id,
            email: r.email,
            display_name: r.display_name,
            role: r.role,
            joined_at: r.joined_at,
        }
    }
}

#[derive(Deserialize)]
pub struct VaultInviteResponse {
    pub id: String,
    pub vault_id: String,
    pub vault_name: String,
    pub inviter_id: String,
    pub invitee_email: String,
    pub role: String,
    pub encrypted_vault_key: Option<String>,
    pub accepted: bool,
    pub expires_at: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInvite {
    pub id: String,
    pub vault_id: String,
    pub vault_name: String,
    pub inviter_id: String,
    pub invitee_email: String,
    pub role: String,
    pub encrypted_vault_key: Option<String>,
    pub accepted: bool,
    pub expires_at: String,
    pub created_at: String,
}

impl From<VaultInviteResponse> for VaultInvite {
    fn from(r: VaultInviteResponse) -> Self {
        Self {
            id: r.id,
            vault_id: r.vault_id,
            vault_name: r.vault_name,
            inviter_id: r.inviter_id,
            invitee_email: r.invitee_email,
            role: r.role,
            encrypted_vault_key: r.encrypted_vault_key,
            accepted: r.accepted,
            expires_at: r.expires_at,
            created_at: r.created_at,
        }
    }
}

#[derive(Deserialize)]
pub struct AcceptInviteResponseBody {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub role: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptInviteResult {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub role: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<AcceptInviteResponseBody> for AcceptInviteResult {
    fn from(r: AcceptInviteResponseBody) -> Self {
        Self {
            id: r.id,
            name: r.name,
            description: r.description,
            owner_id: r.owner_id,
            role: r.role,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Serialize)]
struct CreateInviteRequest {
    invitee_email: String,
    role: String,
    encrypted_vault_key: String,
}

#[derive(Serialize)]
struct UpdateRoleRequest {
    role: String,
}

#[derive(Serialize)]
struct AcceptInviteRequest {
    invite_id: String,
}

#[tauri::command]
pub async fn vault_members_list(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
) -> Result<Vec<VaultMember>, String> {
    let response = client
        .get(&format!("/vaults/v1/{}/members/", vault_id))
        .await?;
    let items: Vec<VaultMemberResponse> = parse_response(response).await?;
    Ok(items.into_iter().map(VaultMember::from).collect())
}

#[tauri::command]
pub async fn vault_member_update_role(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
    user_id: String,
    role: String,
) -> Result<(), String> {
    let body = UpdateRoleRequest { role };
    let response = client
        .patch_json(
            &format!("/vaults/v1/{}/members/{}", vault_id, user_id),
            &body,
        )
        .await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }
    Ok(())
}

#[tauri::command]
pub async fn vault_member_remove(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
    user_id: String,
) -> Result<(), String> {
    let response = client
        .delete(&format!("/vaults/v1/{}/members/{}", vault_id, user_id))
        .await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }
    Ok(())
}

#[tauri::command]
pub async fn vault_invite_create(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
    invitee_email: String,
    role: String,
    encrypted_vault_key: String,
) -> Result<VaultInvite, String> {
    let key = if encrypted_vault_key.is_empty() {
        let vek = crate::sync::crypto::load_vek(&vault_id)?
            .ok_or("Vault encryption key not available. Unlock the vault first.")?;
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &vek)
    } else {
        encrypted_vault_key
    };

    let body = CreateInviteRequest {
        invitee_email,
        role,
        encrypted_vault_key: key,
    };
    let response = client
        .post_json(&format!("/vaults/v1/{}/invites/", vault_id), &body)
        .await?;
    let item: VaultInviteResponse = parse_response(response).await?;
    Ok(VaultInvite::from(item))
}

#[tauri::command]
pub async fn vault_invites_list(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
) -> Result<Vec<VaultInvite>, String> {
    let response = client
        .get(&format!("/vaults/v1/{}/invites/", vault_id))
        .await?;
    let items: Vec<VaultInviteResponse> = parse_response(response).await?;
    Ok(items.into_iter().map(VaultInvite::from).collect())
}

#[tauri::command]
pub async fn vault_invite_delete(
    client: State<'_, SyncHttpClient>,
    vault_id: String,
    invite_id: String,
) -> Result<(), String> {
    let response = client
        .delete(&format!("/vaults/v1/{}/invites/{}", vault_id, invite_id))
        .await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }
    Ok(())
}

#[tauri::command]
pub async fn vault_my_invites(
    client: State<'_, SyncHttpClient>,
) -> Result<Vec<VaultInvite>, String> {
    let response = client.get("/vaults/v1/invites").await?;
    let items: Vec<VaultInviteResponse> = parse_response(response).await?;
    Ok(items.into_iter().map(VaultInvite::from).collect())
}

#[tauri::command]
pub async fn vault_invite_accept(
    client: State<'_, SyncHttpClient>,
    invite_id: String,
) -> Result<AcceptInviteResult, String> {
    let body = AcceptInviteRequest { invite_id };
    let response = client.post_json("/vaults/v1/invites/accept", &body).await?;
    let item: AcceptInviteResponseBody = parse_response(response).await?;
    Ok(AcceptInviteResult::from(item))
}
