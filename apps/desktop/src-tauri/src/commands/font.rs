use font_kit::source::SystemSource;
use serde::Serialize;
use std::collections::BTreeSet;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontInfo {
    family: String,
    postscript_name: Option<String>,
}

#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<FontInfo>, String> {
    let source = SystemSource::new();
    let families = source.all_families().map_err(|e| e.to_string())?;

    let unique: BTreeSet<String> = families.into_iter().collect();

    let fonts: Vec<FontInfo> = unique
        .into_iter()
        .map(|family| FontInfo {
            family,
            postscript_name: None,
        })
        .collect();

    Ok(fonts)
}
