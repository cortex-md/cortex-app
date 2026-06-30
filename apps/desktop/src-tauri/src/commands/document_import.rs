use lopdf::Document;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTextPage {
    pub page_number: u32,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTextExtraction {
    pub pages: Vec<PdfTextPage>,
}

#[tauri::command]
pub fn extract_pdf_text(path: String) -> Result<PdfTextExtraction, String> {
    extract_pdf_text_from_path(Path::new(&path))
}

fn extract_pdf_text_from_path(path: &Path) -> Result<PdfTextExtraction, String> {
    let document = Document::load(path).map_err(|error| format!("Could not open PDF: {error}"))?;
    let pages = document.get_pages();
    let mut extracted_pages = Vec::with_capacity(pages.len());

    for page_number in pages.keys() {
        let text = document.extract_text(&[*page_number]).map_err(|error| {
            format!("Could not extract text from PDF page {page_number}: {error}")
        })?;
        extracted_pages.push(PdfTextPage {
            page_number: *page_number,
            text,
        });
    }

    if extracted_pages
        .iter()
        .all(|page| page.text.trim().is_empty())
    {
        return Err("PDF contains no extractable text".to_string());
    }

    Ok(PdfTextExtraction {
        pages: extracted_pages,
    })
}

#[cfg(test)]
mod tests {
    use super::extract_pdf_text_from_path;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};

    fn write_test_pdf(path: &std::path::Path, pages: &[&str]) {
        let mut document = Document::with_version("1.5");
        let pages_id = document.new_object_id();
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });
        let resources_id = document.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let page_objects = pages
            .iter()
            .map(|text| {
                let content = Content {
                    operations: vec![
                        Operation::new("BT", vec![]),
                        Operation::new("Tf", vec!["F1".into(), 18.into()]),
                        Operation::new("Td", vec![72.into(), 720.into()]),
                        Operation::new("Tj", vec![Object::string_literal(*text)]),
                        Operation::new("ET", vec![]),
                    ],
                };
                let content_id =
                    document.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
                document
                    .add_object(dictionary! {
                        "Type" => "Page",
                        "Parent" => pages_id,
                        "Contents" => content_id,
                    })
                    .into()
            })
            .collect::<Vec<Object>>();

        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => page_objects,
                "Count" => pages.len() as i64,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        document.save(path).unwrap();
    }

    #[test]
    fn extract_pdf_text_returns_text_by_page() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("source.pdf");
        write_test_pdf(&path, &["First page", "Second page"]);

        let extraction = extract_pdf_text_from_path(&path).unwrap();

        assert_eq!(extraction.pages.len(), 2);
        assert!(extraction.pages[0].text.contains("First page"));
        assert!(extraction.pages[1].text.contains("Second page"));
    }

    #[test]
    fn extract_pdf_text_rejects_pdfs_without_text() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("empty.pdf");
        write_test_pdf(&path, &[""]);

        let error = extract_pdf_text_from_path(&path).unwrap_err();

        assert_eq!(error, "PDF contains no extractable text");
    }
}
