use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct SyncPreferences {
    pub sync_settings: bool,
    pub sync_hotkeys: bool,
    pub sync_workspace: bool,
    pub sync_plugin_metadata: bool,
    pub sync_theme_metadata: bool,
    pub sync_bookmarks: bool,
    pub ignore_images: bool,
    pub excluded_paths: Vec<String>,
}

impl Default for SyncPreferences {
    fn default() -> Self {
        Self {
            sync_settings: false,
            sync_hotkeys: false,
            sync_workspace: false,
            sync_plugin_metadata: false,
            sync_theme_metadata: false,
            sync_bookmarks: false,
            ignore_images: false,
            excluded_paths: vec![],
        }
    }
}

#[derive(Debug)]
struct SyncPathPattern {
    negated: bool,
    anchored: bool,
    directory_only: bool,
    has_slash: bool,
    segments: Vec<String>,
}

pub fn is_image_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    let filename = normalized.rsplit('/').next().unwrap_or(&normalized);
    let Some((_, extension)) = filename.rsplit_once('.') else {
        return false;
    };

    matches!(
        extension.to_ascii_lowercase().as_str(),
        "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "avif"
            | "bmp"
            | "tif"
            | "tiff"
            | "heic"
            | "heif"
            | "ico"
            | "svg"
    )
}

fn collapse_slashes(value: &str) -> String {
    let mut collapsed = String::new();
    let mut previous_was_slash = false;
    for character in value.chars() {
        if character == '/' {
            if !previous_was_slash {
                collapsed.push(character);
            }
            previous_was_slash = true;
        } else {
            collapsed.push(character);
            previous_was_slash = false;
        }
    }
    collapsed
}

fn normalize_path_pattern(pattern: &str) -> String {
    let mut normalized = pattern.replace('\\', "/").trim().to_string();
    let negated = normalized.starts_with('!');
    if negated {
        normalized = normalized
            .strip_prefix('!')
            .unwrap_or(&normalized)
            .trim()
            .to_string();
    }
    if let Some(rest) = normalized.strip_prefix("./") {
        normalized = rest.trim_start_matches('/').to_string();
    }
    normalized = collapse_slashes(&normalized);
    if normalized.is_empty() || normalized == "/" {
        return String::new();
    }
    if negated {
        format!("!{normalized}")
    } else {
        normalized
    }
}

fn parse_path_pattern(pattern: &str) -> Option<SyncPathPattern> {
    let normalized = normalize_path_pattern(pattern);
    if normalized.is_empty() || normalized.starts_with('#') {
        return None;
    }

    let negated = normalized.starts_with('!');
    let mut value = if negated {
        normalized
            .strip_prefix('!')
            .unwrap_or(&normalized)
            .to_string()
    } else {
        normalized
    };
    let anchored = value.starts_with('/');
    value = value.trim_start_matches('/').to_string();
    let directory_only = value.ends_with('/');
    value = value.trim_end_matches('/').to_string();
    if value.is_empty() {
        return None;
    }

    Some(SyncPathPattern {
        negated,
        anchored,
        directory_only,
        has_slash: value.contains('/'),
        segments: value.split('/').map(str::to_string).collect(),
    })
}

fn split_path_segments(path: &str) -> Vec<String> {
    let normalized = path
        .replace('\\', "/")
        .trim_start_matches('/')
        .trim_end_matches('/')
        .to_string();
    if normalized.is_empty() {
        return vec![];
    }
    normalized.split('/').map(str::to_string).collect()
}

fn segment_matches_pattern(pattern: &str, segment: &str) -> bool {
    fn matches(
        pattern_chars: &[char],
        segment_chars: &[char],
        pattern_index: usize,
        segment_index: usize,
        memo: &mut HashMap<(usize, usize), bool>,
    ) -> bool {
        if let Some(cached) = memo.get(&(pattern_index, segment_index)) {
            return *cached;
        }

        let result = if pattern_index == pattern_chars.len() {
            segment_index == segment_chars.len()
        } else if pattern_chars[pattern_index] == '*' {
            matches(
                pattern_chars,
                segment_chars,
                pattern_index + 1,
                segment_index,
                memo,
            ) || (segment_index < segment_chars.len()
                && matches(
                    pattern_chars,
                    segment_chars,
                    pattern_index,
                    segment_index + 1,
                    memo,
                ))
        } else if pattern_chars[pattern_index] == '?' {
            segment_index < segment_chars.len()
                && matches(
                    pattern_chars,
                    segment_chars,
                    pattern_index + 1,
                    segment_index + 1,
                    memo,
                )
        } else {
            segment_index < segment_chars.len()
                && pattern_chars[pattern_index] == segment_chars[segment_index]
                && matches(
                    pattern_chars,
                    segment_chars,
                    pattern_index + 1,
                    segment_index + 1,
                    memo,
                )
        };

        memo.insert((pattern_index, segment_index), result);
        result
    }

    let pattern_chars = pattern.chars().collect::<Vec<_>>();
    let segment_chars = segment.chars().collect::<Vec<_>>();
    matches(&pattern_chars, &segment_chars, 0, 0, &mut HashMap::new())
}

fn path_segments_match(
    pattern_segments: &[String],
    path_segments: &[String],
    start_index: usize,
    allow_descendants: bool,
) -> bool {
    fn matches(
        pattern_segments: &[String],
        path_segments: &[String],
        pattern_index: usize,
        path_index: usize,
        allow_descendants: bool,
        memo: &mut HashMap<(usize, usize), bool>,
    ) -> bool {
        if let Some(cached) = memo.get(&(pattern_index, path_index)) {
            return *cached;
        }

        let result = if pattern_index == pattern_segments.len() {
            allow_descendants || path_index == path_segments.len()
        } else if pattern_segments[pattern_index] == "**" {
            let mut matched = false;
            for next_path_index in path_index..=path_segments.len() {
                if matches(
                    pattern_segments,
                    path_segments,
                    pattern_index + 1,
                    next_path_index,
                    allow_descendants,
                    memo,
                ) {
                    matched = true;
                    break;
                }
            }
            matched
        } else {
            path_index < path_segments.len()
                && segment_matches_pattern(
                    &pattern_segments[pattern_index],
                    &path_segments[path_index],
                )
                && matches(
                    pattern_segments,
                    path_segments,
                    pattern_index + 1,
                    path_index + 1,
                    allow_descendants,
                    memo,
                )
        };

        memo.insert((pattern_index, path_index), result);
        result
    }

    matches(
        pattern_segments,
        path_segments,
        0,
        start_index,
        allow_descendants,
        &mut HashMap::new(),
    )
}

fn path_pattern_matches(path: &str, pattern: &SyncPathPattern) -> bool {
    let path_segments = split_path_segments(path);
    if path_segments.is_empty() {
        return false;
    }

    let allow_descendants = pattern.directory_only || !pattern.has_slash;
    if pattern.anchored || pattern.has_slash {
        return path_segments_match(&pattern.segments, &path_segments, 0, allow_descendants);
    }

    for start_index in 0..path_segments.len() {
        if path_segments_match(
            &pattern.segments,
            &path_segments,
            start_index,
            allow_descendants,
        ) {
            return true;
        }
    }

    false
}

fn should_ignore_by_excluded_patterns(path: &str, patterns: &[String]) -> bool {
    let mut ignored = false;
    for raw_pattern in patterns {
        if let Some(pattern) = parse_path_pattern(raw_pattern) {
            if path_pattern_matches(path, &pattern) {
                ignored = !pattern.negated;
            }
        }
    }
    ignored
}

pub fn should_ignore(path: &str, prefs: &SyncPreferences) -> bool {
    let normalized = path.replace('\\', "/");

    let filename = normalized.rsplit('/').next().unwrap_or(&normalized);
    if matches!(filename, ".DS_Store" | "Thumbs.db" | "desktop.ini") {
        return true;
    }

    let is_cortex = normalized.contains("/.cortex/")
        || normalized.ends_with("/.cortex")
        || normalized.starts_with(".cortex/")
        || normalized == ".cortex";

    if !is_cortex {
        if should_ignore_by_excluded_patterns(&normalized, &prefs.excluded_paths) {
            return true;
        }
        if prefs.ignore_images && is_image_path(&normalized) {
            return true;
        }
        return false;
    }

    let cortex_file = normalized
        .rsplit_once("/.cortex/")
        .map(|(_, file)| file)
        .or_else(|| normalized.strip_prefix(".cortex/"))
        .unwrap_or(&normalized);

    if cortex_file == "schema/properties.json" || cortex_file == "schema/databases.json" {
        return false;
    }

    if matches!(
        cortex_file,
        "sync-preferences.json" | "sync.db" | "sync.db-wal" | "sync.db-journal" | "sync.db-shm"
    ) {
        return true;
    }

    match cortex_file {
        "app.json" => !prefs.sync_settings,
        "hotkeys.json" => !prefs.sync_hotkeys,
        "workspace.json" => !prefs.sync_workspace,
        "sync-plugins.json" => !prefs.sync_plugin_metadata,
        "sync-themes.json" => !prefs.sync_theme_metadata,
        "bookmarks.json" => !prefs.sync_bookmarks,
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::{should_ignore, SyncPreferences};

    #[test]
    fn ignores_images_only_when_enabled() {
        let mut prefs = SyncPreferences::default();

        assert!(!should_ignore("attachments/photo.png", &prefs));

        prefs.ignore_images = true;

        assert!(should_ignore("attachments/photo.png", &prefs));
        assert!(!should_ignore("notes/photo.md", &prefs));
    }

    #[test]
    fn image_extension_matching_is_case_insensitive() {
        let prefs = SyncPreferences {
            ignore_images: true,
            ..SyncPreferences::default()
        };

        assert!(should_ignore("attachments/PHOTO.JPEG", &prefs));
        assert!(should_ignore("attachments/diagram.SvG", &prefs));
    }

    #[test]
    fn cortex_paths_keep_existing_preferences() {
        let prefs = SyncPreferences {
            ignore_images: true,
            sync_settings: true,
            ..SyncPreferences::default()
        };

        assert!(!should_ignore(".cortex/app.json", &prefs));
        assert!(!should_ignore(".cortex/schema/properties.json", &prefs));
        assert!(!should_ignore(".cortex/schema/databases.json", &prefs));
        assert!(should_ignore(".cortex/database-index.json", &prefs));
        assert!(should_ignore(".cortex/bookmarks.json", &prefs));
        assert!(should_ignore(".cortex/ui-state.json", &prefs));
        assert!(should_ignore(".cortex/sync-preferences.json", &prefs));
        assert!(should_ignore(".cortex/assets/icon.png", &prefs));
    }

    #[test]
    fn bookmarks_sync_is_opt_in() {
        let mut prefs = SyncPreferences::default();

        assert!(should_ignore(".cortex/bookmarks.json", &prefs));

        prefs.sync_bookmarks = true;

        assert!(!should_ignore(".cortex/bookmarks.json", &prefs));
    }

    #[test]
    fn excluded_paths_match_files_and_directories() {
        let prefs = SyncPreferences {
            excluded_paths: vec!["private.md".to_string(), "archive/".to_string()],
            ..SyncPreferences::default()
        };

        assert!(should_ignore("private.md", &prefs));
        assert!(should_ignore("archive/old.md", &prefs));
        assert!(!should_ignore("archive.md", &prefs));
    }

    #[test]
    fn excluded_paths_match_gitignore_style_patterns() {
        let prefs = SyncPreferences {
            excluded_paths: vec![
                "node_modules/".to_string(),
                "*.log".to_string(),
                "docs/**/*.tmp".to_string(),
                "dist/".to_string(),
                "!dist/keep.md".to_string(),
            ],
            ..SyncPreferences::default()
        };

        assert!(should_ignore("node_modules/package.json", &prefs));
        assert!(should_ignore("packages/app/node_modules/cache.bin", &prefs));
        assert!(should_ignore("logs/debug.log", &prefs));
        assert!(should_ignore("docs/drafts/one.tmp", &prefs));
        assert!(should_ignore("dist/app.js", &prefs));
        assert!(!should_ignore("dist/keep.md", &prefs));
        assert!(!should_ignore("src/node_modules.md", &prefs));
    }
}
