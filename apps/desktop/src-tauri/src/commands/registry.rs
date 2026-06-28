use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultRegistryEntry {
    pub uuid: String,
    pub path: String,
    pub name: String,
    #[serde(rename = "lastOpened")]
    pub last_opened: u64,
    pub icon: Option<String>,
    pub color: Option<String>,
}

fn registry_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let cortex_dir = home.join(".cortex");
    fs::create_dir_all(&cortex_dir).map_err(|e| e.to_string())?;
    Ok(cortex_dir.join("vaults.json"))
}

#[tauri::command]
pub fn read_vault_registry() -> Result<Vec<VaultRegistryEntry>, String> {
    let path = registry_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_vault_registry(
    app: tauri::AppHandle,
    uuid: String,
    path: String,
    name: String,
    icon: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let reg_path = registry_path()?;
    let mut entries = if reg_path.exists() {
        let content = fs::read_to_string(&reg_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<VaultRegistryEntry>>(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    if let Some(existing) = entries.iter_mut().find(|e| e.uuid == uuid) {
        existing.path = path;
        existing.name = name;
        existing.last_opened = now;
        if icon.is_some() {
            existing.icon = icon;
        }
        if color.is_some() {
            existing.color = color;
        }
    } else {
        entries.push(VaultRegistryEntry {
            uuid,
            path,
            name,
            last_opened: now,
            icon,
            color,
        });
    }

    let content = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&reg_path, content).map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    crate::dock_menu::refresh_dock_menu(&app);

    #[cfg(not(target_os = "macos"))]
    let _ = &app;

    Ok(())
}

#[tauri::command]
pub fn remove_from_vault_registry(app: tauri::AppHandle, uuid: String) -> Result<(), String> {
    let reg_path = registry_path()?;
    if !reg_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&reg_path).map_err(|e| e.to_string())?;
    let mut entries: Vec<VaultRegistryEntry> = serde_json::from_str(&content).unwrap_or_default();

    entries.retain(|e| e.uuid != uuid);

    let content = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&reg_path, content).map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    crate::dock_menu::refresh_dock_menu(&app);

    #[cfg(not(target_os = "macos"))]
    let _ = &app;

    Ok(())
}
