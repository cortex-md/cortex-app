import type { ExportHtmlToPdfOptions, DocumentExport as IDocumentExport } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class DocumentExport implements IDocumentExport {
	async exportHtmlToPdf(options: ExportHtmlToPdfOptions): Promise<void> {
		await invoke<void>("export_html_to_pdf", {
			html: options.html,
			path: options.targetPath,
			title: options.title,
		})
	}
}
