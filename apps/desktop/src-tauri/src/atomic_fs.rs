use atomic_write_file::AtomicWriteFile;
use std::io::Write;
use std::path::Path;

pub fn atomic_write_bytes(path: &Path, content: &[u8]) -> Result<(), String> {
    atomic_write_with(path, |file| {
        file.write_all(content).map_err(|error| error.to_string())
    })
}

pub fn atomic_write_string(path: &Path, content: &str) -> Result<(), String> {
    atomic_write_bytes(path, content.as_bytes())
}

fn atomic_write_with(
    path: &Path,
    write: impl FnOnce(&mut AtomicWriteFile) -> Result<(), String>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut file = AtomicWriteFile::options()
        .open(path)
        .map_err(|error| error.to_string())?;
    write(&mut file)?;
    file.commit().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn test_directory() -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("cortex-atomic-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn replaces_existing_content() {
        let directory = test_directory();
        let path = directory.join("note.md");
        std::fs::write(&path, "old").unwrap();

        atomic_write_string(&path, "new").unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "new");
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn interrupted_write_preserves_existing_content() {
        let directory = test_directory();
        let path = directory.join("note.md");
        std::fs::write(&path, "old").unwrap();

        let result = atomic_write_with(&path, |file| {
            file.write_all(b"partial")
                .map_err(|error| error.to_string())?;
            Err("interrupted".to_string())
        });

        assert_eq!(result.unwrap_err(), "interrupted");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "old");
        std::fs::remove_dir_all(directory).unwrap();
    }
}
