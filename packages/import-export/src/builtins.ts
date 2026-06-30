import { getPlatform } from "@cortex/platform"
import {
	csvRecordsToMarkdownTable,
	extractFirstMarkdownTable,
	parseCsvRecords,
	stringifyCsvRecords,
} from "./csv"
import { htmlToMarkdown, renderMarkdownExportHtml } from "./html"
import type { Exporter, Importer } from "./registry"

export const csvImporter: Importer = {
	id: "csv",
	label: "CSV",
	extensions: ["csv"],
	async importFile(input) {
		const content = await getPlatform().fs.readFile(input.sourcePath)
		const table = csvRecordsToMarkdownTable(parseCsvRecords(content))
		return {
			content: `# ${input.targetPath.split("/").pop()?.replace(/\.md$/iu, "") ?? "Imported CSV"}\n\n${table}\n`,
		}
	},
}

export const htmlImporter: Importer = {
	id: "html",
	label: "HTML",
	extensions: ["html", "htm"],
	async importFile(input) {
		const content = await getPlatform().fs.readFile(input.sourcePath)
		const markdown = htmlToMarkdown(content)
		return {
			content: markdown ? `${markdown}\n` : "",
		}
	},
}

export const pdfImporter: Importer = {
	id: "pdf",
	label: "PDF",
	extensions: ["pdf"],
	async importFile(input) {
		const extractPdfText = getPlatform().documentImport?.extractPdfText
		if (!extractPdfText) throw new Error("This platform cannot extract PDF text")
		const extraction = await extractPdfText({ path: input.sourcePath })
		const title = input.targetPath.split("/").pop()?.replace(/\.md$/iu, "") ?? "Imported PDF"
		const pages = extraction.pages
			.map((page) => ({
				pageNumber: page.pageNumber,
				text: normalizePdfText(page.text),
			}))
			.filter((page) => page.text.length > 0)
		if (pages.length === 0) throw new Error("PDF contains no extractable text")

		return {
			content: `# ${title}\n\n${formatPdfPages(pages)}\n`,
		}
	},
}

export const csvExporter: Exporter = {
	id: "csv",
	label: "CSV",
	extension: "csv",
	mimeType: "text/csv",
	async exportFile(input) {
		const table = extractFirstMarkdownTable(input.markdown)
		const records = table ?? [["title", "content"], [input.title, input.markdown.trim()]]
		return {
			content: stringifyCsvRecords(records),
			extension: "csv",
			mimeType: "text/csv",
		}
	},
}

export const htmlExporter: Exporter = {
	id: "html",
	label: "HTML",
	extension: "html",
	mimeType: "text/html",
	async exportFile(input) {
		return {
			content: await renderMarkdownExportHtml(input.markdown, input.title),
			extension: "html",
			mimeType: "text/html",
		}
	},
}

export const pdfExporter: Exporter = {
	id: "pdf",
	label: "PDF",
	extension: "pdf",
	mimeType: "application/pdf",
	async exportFile(input) {
		const content = await renderMarkdownExportHtml(input.markdown, input.title)
		return {
			content,
			extension: "pdf",
			mimeType: "application/pdf",
			pdfHtml: content,
		}
	},
}

export const builtInImporters = [csvImporter, htmlImporter, pdfImporter] as const
export const builtInExporters = [csvExporter, htmlExporter, pdfExporter] as const

function normalizePdfText(text: string): string {
	return text
		.replace(/\r\n?/gu, "\n")
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n")
		.trim()
}

function formatPdfPages(pages: Array<{ pageNumber: number; text: string }>): string {
	if (pages.length === 1) return pages[0].text
	return pages.map(formatPdfPage).join("\n\n---\n\n")
}

function formatPdfPage(page: { pageNumber: number; text: string }): string {
	return `## Page ${page.pageNumber}\n\n${page.text}`
}
