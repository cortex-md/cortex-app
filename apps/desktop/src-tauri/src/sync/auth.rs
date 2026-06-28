use serde::{Deserialize, Serialize};

use crate::device;
use crate::sync::http::{self, parse_response, SyncHttpClient};

#[derive(Serialize)]
struct LoginRequest {
    email: String,
    password: String,
    device_id: String,
    device_name: String,
    device_type: String,
}

#[derive(Deserialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub email: String,
    #[serde(default)]
    pub display_name: Option<String>,
}

#[derive(Serialize)]
struct RegisterRequest {
    email: String,
    password: String,
    display_name: String,
}

#[derive(Deserialize)]
pub struct RegisterResponse {
    pub user_id: String,
    pub email: String,
    pub display_name: String,
}

#[derive(Serialize)]
struct LogoutRequest {
    all_devices: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub authenticated: bool,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUser {
    pub user_id: String,
    pub email: String,
    pub display_name: Option<String>,
}

pub async fn login(
    client: &SyncHttpClient,
    email: &str,
    password: &str,
) -> Result<LoginResponse, String> {
    let device_info = device::get_device_info()?;

    let body = LoginRequest {
        email: email.to_string(),
        password: password.to_string(),
        device_id: device_info.device_id,
        device_name: device_info.device_name,
        device_type: device_info.device_type,
    };

    let response = client.post_json("/auth/v1/login", &body).await?;
    let login_resp: LoginResponse = parse_response(response).await?;

    let server_url = client.get_server_url();
    http::store_tokens_for_server(
        &server_url,
        &login_resp.access_token,
        &login_resp.refresh_token,
    )?;
    http::store_user_for_server(
        &server_url,
        &login_resp.user_id,
        &login_resp.email,
        login_resp.display_name.as_deref(),
    )?;

    Ok(login_resp)
}

pub async fn register(
    client: &SyncHttpClient,
    email: &str,
    password: &str,
    display_name: &str,
) -> Result<RegisterResponse, String> {
    let body = RegisterRequest {
        email: email.to_string(),
        password: password.to_string(),
        display_name: display_name.to_string(),
    };

    let response = client.post_json("/auth/v1/register", &body).await?;
    let register_resp: RegisterResponse = parse_response(response).await?;
    let server_url = client.get_server_url();
    http::store_user_for_server(
        &server_url,
        &register_resp.user_id,
        &register_resp.email,
        Some(&register_resp.display_name),
    )?;

    Ok(register_resp)
}

pub async fn logout(
    client: &SyncHttpClient,
    server_url: &str,
    all_devices: bool,
) -> Result<(), String> {
    client.set_server_url(server_url);
    let body = LogoutRequest { all_devices };
    let remote_result = match client.post_json("/auth/v1/logout", &body).await {
        Ok(response) => {
            let status = response.status();
            if !status.is_success() {
                let body = response.text().await.unwrap_or_default();
                Err(format!("Logout failed: HTTP {}: {}", status.as_u16(), body))
            } else {
                Ok(())
            }
        }
        Err(e) => Err(e),
    };
    http::clear_tokens_and_user_info_for_server(server_url)?;
    remote_result
}

pub fn get_auth_status(server_url: &str) -> Result<AuthStatus, String> {
    let authenticated = http::has_tokens_for_server(server_url)?;
    if authenticated {
        let (user_id, email, display_name) = http::get_user_for_server(server_url)?;
        Ok(AuthStatus {
            authenticated: true,
            user_id,
            email,
            display_name,
        })
    } else {
        Ok(AuthStatus {
            authenticated: false,
            user_id: None,
            email: None,
            display_name: None,
        })
    }
}

pub fn get_current_user(server_url: &str) -> Result<Option<CurrentUser>, String> {
    let (user_id, email, display_name) = http::get_user_for_server(server_url)?;
    match (user_id, email) {
        (Some(uid), Some(e)) => Ok(Some(CurrentUser {
            user_id: uid,
            email: e,
            display_name,
        })),
        _ => Ok(None),
    }
}
