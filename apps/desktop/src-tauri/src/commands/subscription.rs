use serde::{Deserialize, Serialize};
use tauri::State;

use crate::sync::http::{parse_response, SyncHttpClient};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionStatus {
    pub status: String,
    pub entitled: bool,
    pub current_period_start: Option<String>,
    pub current_period_end: Option<String>,
    pub entitlement_expires_at: Option<String>,
    pub billing_cycle: Option<String>,
    pub plan_product_id: Option<String>,
}

#[derive(Deserialize)]
struct SubscriptionStatusResponse {
    status: String,
    entitled: bool,
    current_period_start: Option<String>,
    current_period_end: Option<String>,
    entitlement_expires_at: Option<String>,
    billing_cycle: Option<String>,
    plan_product_id: Option<String>,
}

impl From<SubscriptionStatusResponse> for SubscriptionStatus {
    fn from(response: SubscriptionStatusResponse) -> Self {
        Self {
            status: response.status,
            entitled: response.entitled,
            current_period_start: response.current_period_start,
            current_period_end: response.current_period_end,
            entitlement_expires_at: response.entitlement_expires_at,
            billing_cycle: response.billing_cycle,
            plan_product_id: response.plan_product_id,
        }
    }
}

#[tauri::command]
pub async fn subscription_get_status(
    client: State<'_, SyncHttpClient>,
    server_url: String,
) -> Result<SubscriptionStatus, String> {
    client.set_server_url(&server_url);
    let response = client.get("/subscription/v1/status").await?;

    if response.status().as_u16() == 404 {
        return Ok(SubscriptionStatus {
            status: "disabled".to_string(),
            entitled: true,
            current_period_start: None,
            current_period_end: None,
            entitlement_expires_at: None,
            billing_cycle: None,
            plan_product_id: None,
        });
    }

    let raw: SubscriptionStatusResponse = parse_response(response).await?;
    Ok(raw.into())
}
