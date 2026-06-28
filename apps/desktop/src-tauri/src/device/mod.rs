use serde::Serialize;
use uuid::Uuid;

use crate::keychain;

const DEVICE_ID_KEY: &str = "device_id";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub device_type: String,
}

pub fn get_device_id() -> Result<String, String> {
    if let Some(id) = keychain::get(DEVICE_ID_KEY)? {
        return Ok(id);
    }
    let id = Uuid::new_v4().to_string();
    keychain::set(DEVICE_ID_KEY, &id)?;
    Ok(id)
}

pub fn get_device_info() -> Result<DeviceInfo, String> {
    let device_id = get_device_id()?;
    let device_name = gethostname::gethostname().to_string_lossy().to_string();
    Ok(DeviceInfo {
        device_id,
        device_name,
        device_type: "desktop".to_string(),
    })
}
