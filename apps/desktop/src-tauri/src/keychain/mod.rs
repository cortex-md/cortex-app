use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

static STORE: Mutex<Option<CredentialStore>> = Mutex::new(None);

#[derive(Serialize, Deserialize)]
struct EncryptedPayload {
    nonce: String,
    data: String,
}

struct CredentialStore {
    path: PathBuf,
    key: [u8; 32],
    entries: HashMap<String, String>,
}

impl CredentialStore {
    fn load(path: PathBuf, key: [u8; 32]) -> Self {
        let entries = Self::decrypt_file(&path, &key).unwrap_or_default();
        Self { path, key, entries }
    }

    fn decrypt_file(path: &PathBuf, key: &[u8; 32]) -> Result<HashMap<String, String>, String> {
        let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let payload: EncryptedPayload = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        let nonce_bytes = encoding::decode(&payload.nonce)?;
        let ciphertext = encoding::decode(&payload.data)?;
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| "failed to decrypt credential store".to_string())?;
        let json = String::from_utf8(plaintext).map_err(|e| e.to_string())?;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    }

    fn flush(&self) -> Result<(), String> {
        let json = serde_json::to_string(&self.entries).map_err(|e| e.to_string())?;
        let cipher = Aes256Gcm::new_from_slice(&self.key).map_err(|e| e.to_string())?;
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, json.as_bytes())
            .map_err(|e| e.to_string())?;
        let payload = EncryptedPayload {
            nonce: encoding::encode(&nonce_bytes),
            data: encoding::encode(&ciphertext),
        };
        let raw = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&self.path, raw).map_err(|e| e.to_string())
    }
}

mod encoding {
    use base64::{engine::general_purpose::STANDARD, Engine};

    pub fn encode(bytes: &[u8]) -> String {
        STANDARD.encode(bytes)
    }

    pub fn decode(s: &str) -> Result<Vec<u8>, String> {
        STANDARD.decode(s).map_err(|e| e.to_string())
    }
}

fn cortex_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("could not determine home directory")?;
    Ok(home.join(".cortex"))
}

fn store_path() -> Result<PathBuf, String> {
    Ok(cortex_dir()?.join("credentials.enc"))
}

fn key_path() -> Result<PathBuf, String> {
    Ok(cortex_dir()?.join("credentials.key"))
}

fn load_or_create_key() -> Result<[u8; 32], String> {
    let path = key_path()?;

    if path.exists() {
        let raw = fs::read(&path).map_err(|e| e.to_string())?;
        if raw.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&raw);
            return Ok(key);
        }
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &key).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
    }

    Ok(key)
}

fn migrate_legacy_store(new_key: &[u8; 32]) {
    let dir = match cortex_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let legacy_path = dir.join("credentials.enc");
    let migrated_marker = dir.join("credentials.enc.v1migrated");

    if migrated_marker.exists() || !legacy_path.exists() {
        return;
    }

    if let Ok(entries) = decrypt_legacy_store(&legacy_path) {
        let new_store_path = store_path().unwrap();
        let store = CredentialStore {
            path: new_store_path,
            key: *new_key,
            entries,
        };
        let _ = store.flush();
    }

    let _ = fs::write(&migrated_marker, "migrated");
}

fn decrypt_legacy_store(path: &std::path::Path) -> Result<HashMap<String, String>, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let payload: EncryptedPayload = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let nonce_bytes = encoding::decode(&payload.nonce)?;
    let ciphertext = encoding::decode(&payload.data)?;

    let machine_id = legacy_machine_identity()?;
    let key = blake3::derive_key("cortex credential store v1", machine_id.as_bytes());

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "failed to decrypt legacy credential store".to_string())?;
    let json = String::from_utf8(plaintext).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

fn with_store<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&mut CredentialStore) -> Result<R, String>,
{
    let mut guard = STORE.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let key = load_or_create_key()?;
        migrate_legacy_store(&key);
        let path = store_path()?;
        *guard = Some(CredentialStore::load(path, key));
    }
    f(guard.as_mut().unwrap())
}

pub fn set(account: &str, value: &str) -> Result<(), String> {
    with_store(|store| {
        store.entries.insert(account.to_string(), value.to_string());
        store.flush()
    })
}

pub fn get(account: &str) -> Result<Option<String>, String> {
    with_store(|store| Ok(store.entries.get(account).cloned()))
}

pub fn delete(account: &str) -> Result<(), String> {
    with_store(|store| {
        store.entries.remove(account);
        store.flush()
    })
}

#[cfg(target_os = "macos")]
fn legacy_machine_identity() -> Result<String, String> {
    let output = std::process::Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("IOPlatformUUID") {
            if let Some(uuid) = line.split('"').nth(3) {
                return Ok(uuid.to_string());
            }
        }
    }
    Err("could not read IOPlatformUUID".to_string())
}

#[cfg(target_os = "windows")]
fn legacy_machine_identity() -> Result<String, String> {
    let output = std::process::Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("MachineGuid") {
            if let Some(guid) = line.split_whitespace().last() {
                return Ok(guid.to_string());
            }
        }
    }
    Err("could not read MachineGuid from registry".to_string())
}

#[cfg(target_os = "linux")]
fn legacy_machine_identity() -> Result<String, String> {
    fs::read_to_string("/etc/machine-id")
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("could not read /etc/machine-id: {}", e))
}
