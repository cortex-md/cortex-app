export interface PdfTextPage {
	pageNumber: number
	text: string
}

export interface PdfTextExtraction {
	pages: PdfTextPage[]
}

export interface PdfTextExtractionOptions {
	path: string
}

export interface DocumentImport {
	extractPdfText(options: PdfTextExtractionOptions): Promise<PdfTextExtraction>
}
