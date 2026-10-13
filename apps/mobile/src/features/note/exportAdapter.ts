import { noteCache } from "@cortex/core"
import { renderMarkdownExportHtml, stringifyCsvRecords } from "@cortex/import-export"
import { getNoteTitle } from "@cortex/platform/utils"
import { parseFrontmatter } from "@cortex/properties"
import { Share } from "react-native"

export type ExportFormat = "html" | "pdf" | "csv"

export const exportFormatLabels: Record<ExportFormat, string> = {
	csv: "CSV",
	html: "HTML",
	pdf: "PDF",
}

export const EXPORT_FOOTER =
	"HTML keeps headings, links and images as a web page. PDF is a print-ready copy of the note. CSV exports the note's properties as one row."

function stringifyValue(value: unknown): string {
	if (Array.isArray(value)) return value.map(stringifyValue).join(", ")
	if (value === undefined || value === null) return ""
	return typeof value === "object" ? JSON.stringify(value) : String(value)
}

function toCsv(title: string, meta: Record<string, unknown>): string {
	const keys = Object.keys(meta)
	return stringifyCsvRecords([
		["title", ...keys],
		[title, ...keys.map((key) => stringifyValue(meta[key]))],
	])
}

async function buildPdfSource(title: string, body: string): Promise<string> {
	// stub: native PDF printing is not wired on mobile; share the rendered HTML a printer can open
	return renderMarkdownExportHtml(body, title)
}

async function buildExport(filePath: string, format: ExportFormat): Promise<string> {
	const raw = await noteCache.read(filePath)
	const title = getNoteTitle(filePath)
	const { body, meta } = parseFrontmatter(raw)
	switch (format) {
		case "csv":
			return toCsv(title, meta)
		case "html":
			return renderMarkdownExportHtml(body, title)
		case "pdf":
			return buildPdfSource(title, body)
	}
}

export async function exportNote(filePath: string, format: ExportFormat): Promise<boolean> {
	const message = await buildExport(filePath, format)
	const result = await Share.share({ message, title: `${getNoteTitle(filePath)}.${format}` })
	return result.action === Share.sharedAction
}
