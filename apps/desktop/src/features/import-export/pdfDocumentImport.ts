import type { DocumentImport, PdfTextPage } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"

async function loadPdfjs() {
	const [pdfjs, worker] = await Promise.all([
		import("pdfjs-dist"),
		import("pdfjs-dist/build/pdf.worker.mjs?url"),
	])
	pdfjs.GlobalWorkerOptions.workerSrc ||= worker.default
	return pdfjs
}

export const pdfDocumentImport: DocumentImport = {
	extractPdfText: async ({ path }) => {
		const readBinaryFile = getPlatform().fs.readBinaryFile
		if (!readBinaryFile) throw new Error("This platform cannot read PDF files")
		const [pdfjs, data] = await Promise.all([loadPdfjs(), readBinaryFile(path)])
		const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
		try {
			const document = await loadingTask.promise
			const pages: PdfTextPage[] = []
			for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
				const content = await (await document.getPage(pageNumber)).getTextContent()
				const text = content.items
					.map((item) => ("str" in item ? item.str : ""))
					.join(" ")
					.trim()
				pages.push({ pageNumber, text })
			}
			if (pages.every((page) => !page.text)) throw new Error("PDF contains no extractable text")
			return { pages }
		} finally {
			await loadingTask.destroy()
		}
	},
}
