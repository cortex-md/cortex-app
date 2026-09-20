import { BrowserWindow } from "electron"
import { promises as fs } from "node:fs"
import { dirname } from "node:path"

export interface PdfTextPage {
	pageNumber: number
	text: string
}

export interface PdfTextExtraction {
	pages: PdfTextPage[]
}

export async function extractPdfText(path: string): Promise<PdfTextExtraction> {
	const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
	const data = new Uint8Array(await fs.readFile(path))
	const document = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
	const pages: PdfTextPage[] = []

	for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
		const page = await document.getPage(pageNumber)
		const content = await page.getTextContent()
		const text = content.items
			.map((item) => ("str" in item ? item.str : ""))
			.join(" ")
			.trim()
		pages.push({ pageNumber, text })
	}

	if (pages.every((page) => !page.text.trim())) {
		throw new Error("PDF contains no extractable text")
	}

	return { pages }
}

export async function exportHtmlToPdf(path: string, html: string, title: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true })
	const window = new BrowserWindow({
		show: false,
		webPreferences: {
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	})

	try {
		const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`
		await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(documentHtml)}`)
		const pdf = await window.webContents.printToPDF({
			printBackground: true,
			margins: {
				marginType: "custom",
				top: 0.75,
				bottom: 0.75,
				left: 0.75,
				right: 0.75,
			},
		})
		await fs.writeFile(path, pdf)
	} finally {
		window.destroy()
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
}
