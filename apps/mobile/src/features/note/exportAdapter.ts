import { noteCache } from "@cortex/core"
import {
	renderMarkdownExportHtml,
	sanitizeFileStem,
	stringifyCsvRecords,
} from "@cortex/import-export"
import { getNoteTitle } from "@cortex/platform/utils"
import { parseFrontmatter } from "@cortex/properties"
import { Directory, File, Paths } from "expo-file-system"
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"

export type ExportFormat = "html" | "pdf" | "csv"

export const exportFormatLabels: Record<ExportFormat, string> = {
	csv: "CSV",
	html: "HTML",
	pdf: "PDF",
}

export const exportFormatDescriptions: Record<ExportFormat, string> = {
	csv: "The note's properties as one row.",
	html: "A web page with headings, links and images.",
	pdf: "A print-ready copy of the note.",
}

const MIME_TYPES: Record<ExportFormat, { mimeType: string; UTI: string }> = {
	csv: { mimeType: "text/csv", UTI: "public.comma-separated-values-text" },
	html: { mimeType: "text/html", UTI: "public.html" },
	pdf: { mimeType: "application/pdf", UTI: "com.adobe.pdf" },
}

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

function exportFile(title: string, format: ExportFormat): File {
	const directory = new Directory(Paths.cache, "exports")
	directory.create({ idempotent: true, intermediates: true })
	const file = new File(directory, `${sanitizeFileStem(title) || "Note"}.${format}`)
	if (file.exists) file.delete()
	return file
}

async function writeExport(filePath: string, format: ExportFormat): Promise<File> {
	const raw = await noteCache.read(filePath)
	const title = getNoteTitle(filePath)
	const { body, meta } = parseFrontmatter(raw)
	const target = exportFile(title, format)
	if (format === "csv") {
		target.write(toCsv(title, meta))
		return target
	}
	const html = await renderMarkdownExportHtml(body, title)
	if (format === "html") {
		target.write(html)
		return target
	}
	const printed = await Print.printToFileAsync({ html })
	new File(printed.uri).move(target)
	return target
}

export async function exportNote(filePath: string, format: ExportFormat): Promise<boolean> {
	if (!(await Sharing.isAvailableAsync()))
		throw new Error("Sharing is not available on this device")
	const file = await writeExport(filePath, format)
	await Sharing.shareAsync(file.uri, {
		...MIME_TYPES[format],
		dialogTitle: `Export ${getNoteTitle(filePath)}`,
	})
	return true
}
