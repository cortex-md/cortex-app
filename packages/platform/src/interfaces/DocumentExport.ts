export interface ExportHtmlToPdfOptions {
	title: string
	html: string
	targetPath: string
}

export interface DocumentExport {
	exportHtmlToPdf(options: ExportHtmlToPdfOptions): Promise<void>
}
