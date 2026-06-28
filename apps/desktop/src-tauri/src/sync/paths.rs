use std::path::Path;

pub fn normalize_path_separators(path: &str) -> String {
    path.replace('\\', "/")
}

pub fn normalize_relative_path(path: &str) -> String {
    normalize_path_separators(path)
        .trim_start_matches('/')
        .to_string()
}

pub fn to_vault_relative_path(vault_path: &str, path: &str) -> String {
    if let Ok(relative) = Path::new(path).strip_prefix(vault_path) {
        return normalize_relative_path(&relative.to_string_lossy());
    }

    let normalized_path = normalize_path_separators(path);
    let normalized_vault = normalize_path_separators(vault_path)
        .trim_end_matches('/')
        .to_string();
    let prefix = format!("{normalized_vault}/");
    if let Some(relative) = normalized_path.strip_prefix(&prefix) {
        return normalize_relative_path(relative);
    }
    normalized_path
}

#[cfg(test)]
mod tests {
    use super::{normalize_relative_path, to_vault_relative_path};

    #[test]
    fn normalizes_windows_relative_paths() {
        assert_eq!(normalize_relative_path("Notes\\Plan.md"), "Notes/Plan.md");
    }

    #[test]
    fn derives_windows_relative_paths_from_logical_roots() {
        assert_eq!(
            to_vault_relative_path(
                "C:\\Users\\Luiza\\Vault",
                "C:\\Users\\Luiza\\Vault\\Note.md"
            ),
            "Note.md"
        );
    }
}
