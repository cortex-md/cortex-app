use crate::keychain;

#[tauri::command]
pub fn keychain_set(key: String, value: String) -> Result<(), String> {
    keychain::set(&key, &value)
}

#[tauri::command]
pub fn keychain_get(key: String) -> Result<Option<String>, String> {
    keychain::get(&key)
}

#[tauri::command]
pub fn keychain_delete(key: String) -> Result<(), String> {
    keychain::delete(&key)
}
