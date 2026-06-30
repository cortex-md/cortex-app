use ironpress::{HtmlConverter, Margin};
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn export_html_to_pdf(path: String, html: String, title: String) -> Result<(), String> {
    export_html_to_pdf_file(Path::new(&path), &html, &title)
}

fn export_html_to_pdf_file(path: &Path, html: &str, title: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let pdf = HtmlConverter::new()
        .margin(Margin::uniform(54.0))
        .convert(html)
        .map_err(|error| format!("Could not render PDF export for {title}: {error}"))?;
    fs::write(path, pdf).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::export_html_to_pdf_file;

    #[test]
    fn export_html_to_pdf_writes_pdf_bytes() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("note.pdf");

        export_html_to_pdf_file(
            &path,
            "<!doctype html><html><body><h1>Hello</h1><p>World</p></body></html>",
            "Note",
        )
        .unwrap();

        let bytes = std::fs::read(path).unwrap();
        assert!(bytes.starts_with(b"%PDF"));
    }
}
