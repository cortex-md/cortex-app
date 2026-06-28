use crate::commands::fs::FileEntry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultIdentity {
    pub uuid: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultMetadata {
    pub uuid: String,
    pub path: String,
    pub name: String,
    pub file_count: usize,
}

fn ensure_cortex_dir(vault_path: &str) -> Result<(), String> {
    let cortex_dir = Path::new(vault_path).join(".cortex");
    fs::create_dir_all(&cortex_dir).map_err(|e| e.to_string())
}

fn read_or_create_vault_id(vault_path: &str) -> Result<String, String> {
    let id_path = Path::new(vault_path).join(".cortex/vault-id.json");
    if id_path.exists() {
        let content = fs::read_to_string(&id_path).map_err(|e| e.to_string())?;
        let identity: VaultIdentity = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(identity.uuid)
    } else {
        let uuid = Uuid::new_v4().to_string();
        let identity = VaultIdentity { uuid: uuid.clone() };
        let content = serde_json::to_string_pretty(&identity).map_err(|e| e.to_string())?;
        fs::write(&id_path, content).map_err(|e| e.to_string())?;
        Ok(uuid)
    }
}

#[tauri::command]
pub fn open_vault(path: String) -> Result<VaultMetadata, String> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!(
            "Path does not exist or is not a directory: {}",
            path
        ));
    }
    ensure_cortex_dir(&path)?;
    let uuid = read_or_create_vault_id(&path)?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());
    Ok(VaultMetadata {
        uuid,
        path,
        name,
        file_count: 0,
    })
}

#[tauri::command]
pub fn scan_vault(path: String) -> Result<Vec<FileEntry>, String> {
    let mut files = Vec::new();
    scan_recursive(Path::new(&path), &mut files, true)?;
    Ok(files)
}

fn scan_recursive(dir: &Path, files: &mut Vec<FileEntry>, is_root: bool) -> Result<(), String> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            if is_root {
                return Err(error.to_string());
            }
            return Ok(());
        }
    };
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let full_path = entry.path().to_string_lossy().to_string();
        let is_dir = metadata.is_dir();
        files.push(FileEntry {
            path: full_path.clone(),
            name: name.clone(),
            is_dir,
            size: metadata.len(),
            mtime,
        });
        if is_dir {
            scan_recursive(&entry.path(), files, false)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_vault_metadata(path: String) -> Result<VaultMetadata, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Vault path does not exist: {}", path));
    }
    let uuid = read_or_create_vault_id(&path)?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());
    let files = scan_vault(path.clone()).unwrap_or_default();
    let file_count = files.iter().filter(|f| !f.is_dir).count();
    Ok(VaultMetadata {
        uuid,
        path,
        name,
        file_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_vault_errors_when_root_is_missing() {
        let missing_path =
            std::env::temp_dir().join(format!("cortex-missing-vault-{}", Uuid::new_v4()));

        let result = scan_vault(missing_path.to_string_lossy().to_string());

        assert!(result.is_err());
    }

    #[cfg(unix)]
    #[test]
    fn scan_vault_keeps_valid_entries_when_child_directory_is_unreadable() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        let note_path = root.join("note.md");
        let locked_dir = root.join("locked");
        fs::write(&note_path, "body").unwrap();
        fs::create_dir(&locked_dir).unwrap();
        fs::set_permissions(&locked_dir, fs::Permissions::from_mode(0o000)).unwrap();

        let result = scan_vault(root.to_string_lossy().to_string());

        fs::set_permissions(&locked_dir, fs::Permissions::from_mode(0o700)).unwrap();
        let files = result.unwrap();
        assert!(files
            .iter()
            .any(|entry| entry.path == note_path.to_string_lossy()));
    }
}
