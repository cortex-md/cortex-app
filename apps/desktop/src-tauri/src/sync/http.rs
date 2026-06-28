use reqwest::{Client, RequestBuilder, Response};
use serde::de::DeserializeOwned;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as AsyncMutex;

use crate::device;
use crate::keychain;

const ACCESS_TOKEN_KEY: &str = "access_token";
const REFRESH_TOKEN_KEY: &str = "refresh_token";
const SERVER_URL_KEY: &str = "server_url";
const USER_ID_KEY: &str = "user_id";
const USER_EMAIL_KEY: &str = "user_email";
const USER_DISPLAY_NAME_KEY: &str = "user_display_name";

pub struct SyncHttpClient {
    client: Client,
    server_url: Mutex<String>,
    app: Option<AppHandle>,
    refresh_lock: AsyncMutex<()>,
}

pub fn subscription_code_from_text(text: &str) -> Option<&'static str> {
    let normalized = text.to_ascii_lowercase();
    if normalized.contains("subscription_expired") || normalized.contains("plan has expired") {
        Some("subscription_expired")
    } else if normalized.contains("subscription_required")
        || normalized.contains("http 402")
        || normalized.contains("plan is required")
    {
        Some("subscription_required")
    } else {
        None
    }
}

pub fn is_subscription_access_error(text: &str) -> bool {
    subscription_code_from_text(text).is_some()
}

pub fn subscription_access_message(code: Option<&str>) -> String {
    match code {
        Some("subscription_expired") => {
            "Your Cortex Cloud plan has expired. Renew your plan to resume sync.".to_string()
        }
        _ => "A Cortex Cloud plan is required to sync with Cortex Cloud.".to_string(),
    }
}

impl SyncHttpClient {
    pub fn new(app: AppHandle) -> Self {
        Self {
            client: Client::new(),
            server_url: Mutex::new(String::new()),
            app: Some(app),
            refresh_lock: AsyncMutex::new(()),
        }
    }

    #[cfg(test)]
    pub fn new_for_test(server_url: &str) -> Self {
        Self {
            client: Client::new(),
            server_url: Mutex::new(normalize_server_url(server_url)),
            app: None,
            refresh_lock: AsyncMutex::new(()),
        }
    }

    pub fn set_server_url(&self, url: &str) {
        let mut server_url = self.server_url.lock().unwrap();
        *server_url = normalize_server_url(url);
    }

    pub fn get_server_url(&self) -> String {
        self.server_url.lock().unwrap().clone()
    }

    pub fn load_server_url(&self) {
        if let Ok(Some(url)) = keychain::get(SERVER_URL_KEY) {
            let mut server_url = self.server_url.lock().unwrap();
            *server_url = url;
        }
    }

    async fn inject_auth_headers(&self, builder: RequestBuilder) -> Result<RequestBuilder, String> {
        if self.app.is_none() {
            return Ok(builder);
        }
        let server_url = self.get_server_url();
        migrate_legacy_auth(&server_url)?;
        let access_token = get_access_token_for_server(&server_url)?;
        let device_id = device::get_device_id()?;

        let builder = builder.header("X-Device-ID", &device_id);

        if let Some(token) = access_token {
            if should_refresh(&token) {
                if let Err(_) = self.refresh_tokens_internal().await {}
                if let Ok(Some(new_token)) = get_access_token_for_server(&server_url) {
                    return Ok(builder.header("Authorization", format!("Bearer {}", new_token)));
                }
            }
            Ok(builder.header("Authorization", format!("Bearer {}", token)))
        } else {
            Ok(builder)
        }
    }

    pub async fn get(&self, path: &str) -> Result<Response, String> {
        let url = format!("{}{}", self.get_server_url(), path);
        let builder = self.client.get(&url);
        let builder = self.inject_auth_headers(builder).await?;
        let response = builder.send().await.map_err(|e| e.to_string())?;

        if response.status().as_u16() == 401 {
            if self.refresh_tokens_internal().await.is_ok() {
                let builder = self.client.get(&url);
                let builder = self.inject_auth_headers(builder).await?;
                return builder.send().await.map_err(|e| e.to_string());
            }
        }

        Ok(response)
    }

    pub async fn post_json<T: serde::Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<Response, String> {
        let url = format!("{}{}", self.get_server_url(), path);
        let builder = self.client.post(&url).json(body);
        let builder = self.inject_auth_headers(builder).await?;
        let response = builder.send().await.map_err(|e| e.to_string())?;

        if response.status().as_u16() == 401 {
            if self.refresh_tokens_internal().await.is_ok() {
                let builder = self.client.post(&url).json(body);
                let builder = self.inject_auth_headers(builder).await?;
                return builder.send().await.map_err(|e| e.to_string());
            }
        }

        Ok(response)
    }

    pub async fn post_bytes(
        &self,
        path: &str,
        body: Vec<u8>,
        headers: Vec<(String, String)>,
    ) -> Result<Response, String> {
        let url = format!("{}{}", self.get_server_url(), path);
        let mut builder = self.client.post(&url).body(body.clone());
        for (key, value) in &headers {
            builder = builder.header(key.as_str(), value.as_str());
        }
        let builder = self.inject_auth_headers(builder).await?;
        let response = builder.send().await.map_err(|e| e.to_string())?;

        if response.status().as_u16() == 401 {
            if self.refresh_tokens_internal().await.is_ok() {
                let mut builder = self.client.post(&url).body(body);
                for (key, value) in &headers {
                    builder = builder.header(key.as_str(), value.as_str());
                }
                let builder = self.inject_auth_headers(builder).await?;
                return builder.send().await.map_err(|e| e.to_string());
            }
        }

        Ok(response)
    }

    pub async fn delete(&self, path: &str) -> Result<Response, String> {
        let url = format!("{}{}", self.get_server_url(), path);
        let builder = self.client.delete(&url);
        let builder = self.inject_auth_headers(builder).await?;
        let response = builder.send().await.map_err(|e| e.to_string())?;

        if response.status().as_u16() == 401 {
            if self.refresh_tokens_internal().await.is_ok() {
                let builder = self.client.delete(&url);
                let builder = self.inject_auth_headers(builder).await?;
                return builder.send().await.map_err(|e| e.to_string());
            }
        }

        Ok(response)
    }

    pub async fn patch_json<T: serde::Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<Response, String> {
        let url = format!("{}{}", self.get_server_url(), path);
        let builder = self.client.patch(&url).json(body);
        let builder = self.inject_auth_headers(builder).await?;
        let response = builder.send().await.map_err(|e| e.to_string())?;

        if response.status().as_u16() == 401 {
            if self.refresh_tokens_internal().await.is_ok() {
                let builder = self.client.patch(&url).json(body);
                let builder = self.inject_auth_headers(builder).await?;
                return builder.send().await.map_err(|e| e.to_string());
            }
        }

        Ok(response)
    }

    pub async fn put_json<T: serde::Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<Response, String> {
        let url = format!("{}{}", self.get_server_url(), path);
        let builder = self.client.put(&url).json(body);
        let builder = self.inject_auth_headers(builder).await?;
        let response = builder.send().await.map_err(|e| e.to_string())?;

        if response.status().as_u16() == 401 {
            if self.refresh_tokens_internal().await.is_ok() {
                let builder = self.client.put(&url).json(body);
                let builder = self.inject_auth_headers(builder).await?;
                return builder.send().await.map_err(|e| e.to_string());
            }
        }

        Ok(response)
    }

    async fn refresh_tokens_internal(&self) -> Result<(), String> {
        let _guard = self.refresh_lock.lock().await;
        let app = self.app.as_ref().ok_or_else(|| {
            "Authentication is unavailable without an application context".to_string()
        })?;

        let server_url = self.get_server_url();
        migrate_legacy_auth(&server_url)?;
        let refresh_token = get_refresh_token_for_server(&server_url)?
            .ok_or_else(|| "No refresh token".to_string())?;

        let url = format!("{}/auth/v1/token/refresh", server_url);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "refresh_token": refresh_token }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();

        if status.as_u16() == 401 || status.as_u16() == 403 {
            clear_tokens_and_user_info_for_server(&server_url)?;
            let _ = app.emit("auth-session-expired", ());
            return Err("Session expired: refresh token revoked or invalid".to_string());
        }

        if !status.is_success() {
            return Err(format!(
                "Token refresh failed with HTTP {}",
                status.as_u16()
            ));
        }

        let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

        if let Some(access) = body["access_token"].as_str() {
            keychain::set(&scoped_key(&server_url, ACCESS_TOKEN_KEY), access)?;
        }
        if let Some(refresh) = body["refresh_token"].as_str() {
            keychain::set(&scoped_key(&server_url, REFRESH_TOKEN_KEY), refresh)?;
        }

        Ok(())
    }
}

pub async fn parse_response<T: DeserializeOwned>(response: Response) -> Result<T, String> {
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status.as_u16(), body));
    }
    response.json::<T>().await.map_err(|e| e.to_string())
}

pub fn normalize_server_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_lowercase()
}

pub fn scoped_key(server_url: &str, key: &str) -> String {
    let normalized = normalize_server_url(server_url);
    let hash = blake3::hash(normalized.as_bytes()).to_hex().to_string();
    format!("sync:{}:{}", hash, key)
}

pub fn store_tokens_for_server(
    server_url: &str,
    access_token: &str,
    refresh_token: &str,
) -> Result<(), String> {
    let normalized = normalize_server_url(server_url);
    keychain::set(&scoped_key(&normalized, ACCESS_TOKEN_KEY), access_token)?;
    keychain::set(&scoped_key(&normalized, REFRESH_TOKEN_KEY), refresh_token)?;
    Ok(())
}

pub fn clear_tokens_for_server(server_url: &str) -> Result<(), String> {
    let normalized = normalize_server_url(server_url);
    keychain::delete(&scoped_key(&normalized, ACCESS_TOKEN_KEY))?;
    keychain::delete(&scoped_key(&normalized, REFRESH_TOKEN_KEY))?;
    Ok(())
}

pub fn store_user_for_server(
    server_url: &str,
    user_id: &str,
    email: &str,
    display_name: Option<&str>,
) -> Result<(), String> {
    let normalized = normalize_server_url(server_url);
    keychain::set(&scoped_key(&normalized, USER_ID_KEY), user_id)?;
    keychain::set(&scoped_key(&normalized, USER_EMAIL_KEY), email)?;
    if let Some(display_name) = display_name {
        keychain::set(
            &scoped_key(&normalized, USER_DISPLAY_NAME_KEY),
            display_name,
        )?;
    }
    Ok(())
}

pub fn clear_tokens_and_user_info_for_server(server_url: &str) -> Result<(), String> {
    let normalized = normalize_server_url(server_url);
    clear_tokens_for_server(&normalized)?;
    let _ = keychain::delete(&scoped_key(&normalized, USER_ID_KEY));
    let _ = keychain::delete(&scoped_key(&normalized, USER_EMAIL_KEY));
    let _ = keychain::delete(&scoped_key(&normalized, USER_DISPLAY_NAME_KEY));
    Ok(())
}

pub fn get_access_token_for_server(server_url: &str) -> Result<Option<String>, String> {
    let normalized = normalize_server_url(server_url);
    migrate_legacy_auth(&normalized)?;
    keychain::get(&scoped_key(&normalized, ACCESS_TOKEN_KEY))
}

pub fn get_refresh_token_for_server(server_url: &str) -> Result<Option<String>, String> {
    let normalized = normalize_server_url(server_url);
    migrate_legacy_auth(&normalized)?;
    keychain::get(&scoped_key(&normalized, REFRESH_TOKEN_KEY))
}

pub fn get_user_for_server(
    server_url: &str,
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    let normalized = normalize_server_url(server_url);
    migrate_legacy_auth(&normalized)?;
    Ok((
        keychain::get(&scoped_key(&normalized, USER_ID_KEY))?,
        keychain::get(&scoped_key(&normalized, USER_EMAIL_KEY))?,
        keychain::get(&scoped_key(&normalized, USER_DISPLAY_NAME_KEY))?,
    ))
}

pub fn has_tokens_for_server(server_url: &str) -> Result<bool, String> {
    let normalized = normalize_server_url(server_url);
    migrate_legacy_auth(&normalized)?;
    let has_access = keychain::get(&scoped_key(&normalized, ACCESS_TOKEN_KEY))?.is_some();
    let has_refresh = keychain::get(&scoped_key(&normalized, REFRESH_TOKEN_KEY))?.is_some();
    Ok(has_access && has_refresh)
}

fn migrate_legacy_auth(server_url: &str) -> Result<(), String> {
    let normalized = normalize_server_url(server_url);
    if normalized.is_empty() {
        return Ok(());
    }

    if keychain::get(&scoped_key(&normalized, ACCESS_TOKEN_KEY))?.is_some() {
        return Ok(());
    }

    let legacy_access = keychain::get(ACCESS_TOKEN_KEY)?;
    let legacy_refresh = keychain::get(REFRESH_TOKEN_KEY)?;
    let legacy_server = keychain::get(SERVER_URL_KEY)?.unwrap_or_default();
    let legacy_matches =
        legacy_server.trim().is_empty() || normalize_server_url(&legacy_server) == normalized;

    if !legacy_matches {
        return Ok(());
    }

    if let Some(access) = legacy_access {
        keychain::set(&scoped_key(&normalized, ACCESS_TOKEN_KEY), &access)?;
    }
    if let Some(refresh) = legacy_refresh {
        keychain::set(&scoped_key(&normalized, REFRESH_TOKEN_KEY), &refresh)?;
    }
    if let Some(user_id) = keychain::get(USER_ID_KEY)? {
        keychain::set(&scoped_key(&normalized, USER_ID_KEY), &user_id)?;
    }
    if let Some(email) = keychain::get(USER_EMAIL_KEY)? {
        keychain::set(&scoped_key(&normalized, USER_EMAIL_KEY), &email)?;
    }
    if let Some(display_name) = keychain::get(USER_DISPLAY_NAME_KEY)? {
        keychain::set(
            &scoped_key(&normalized, USER_DISPLAY_NAME_KEY),
            &display_name,
        )?;
    }

    let _ = keychain::delete(ACCESS_TOKEN_KEY);
    let _ = keychain::delete(REFRESH_TOKEN_KEY);
    let _ = keychain::delete(USER_ID_KEY);
    let _ = keychain::delete(USER_EMAIL_KEY);
    let _ = keychain::delete(USER_DISPLAY_NAME_KEY);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        is_subscription_access_error, normalize_server_url, scoped_key, subscription_code_from_text,
    };

    #[test]
    fn normalizes_server_url_for_auth_scope() {
        assert_eq!(
            normalize_server_url("HTTPS://Sync.Example.com///"),
            "https://sync.example.com"
        );
    }

    #[test]
    fn scopes_auth_keys_by_server_url() {
        assert_eq!(
            scoped_key("https://sync.example.com", "access_token"),
            scoped_key("https://sync.example.com/", "access_token")
        );
        assert_ne!(
            scoped_key("https://sync.example.com", "access_token"),
            scoped_key("https://self.hosted", "access_token")
        );
    }

    #[test]
    fn detects_subscription_access_errors() {
        assert!(is_subscription_access_error(
            r#"HTTP 402: {"code":"subscription_required"}"#
        ));
        assert_eq!(
            subscription_code_from_text(r#"{"code":"subscription_expired"}"#),
            Some("subscription_expired")
        );
        assert_eq!(
            subscription_code_from_text(
                "Your Cortex Cloud plan has expired. Renew your plan to resume sync."
            ),
            Some("subscription_expired")
        );
        assert!(!is_subscription_access_error("HTTP 403: forbidden"));
    }
}

fn should_refresh(token: &str) -> bool {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return false;
    }
    let payload =
        match base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, parts[1]) {
            Ok(p) => p,
            Err(_) => return false,
        };
    let json: serde_json::Value = match serde_json::from_slice(&payload) {
        Ok(j) => j,
        Err(_) => return false,
    };
    let exp = match json["exp"].as_i64() {
        Some(e) => e,
        None => return false,
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    exp - now < 60
}
