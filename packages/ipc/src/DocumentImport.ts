import type {
	DocumentImport as IDocumentImport,
	PdfTextExtraction,
	PdfTextExtractionOptions,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class DocumentImport implements IDocumentImport {
	async extractPdfText(options: PdfTextExtractionOptions): Promise<PdfTextExtraction> {
		return await invoke<PdfTextExtraction>("extract_pdf_text", { path: options.path })
	}
}
