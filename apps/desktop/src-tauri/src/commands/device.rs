use crate::device::{self, DeviceInfo};

#[tauri::command]
pub fn get_device_id() -> Result<String, String> {
    device::get_device_id()
}

#[tauri::command]
pub fn get_device_info() -> Result<DeviceInfo, String> {
    device::get_device_info()
}
