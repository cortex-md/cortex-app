import { noteCache, useVaultStore } from "@cortex/core"
import {
	exportNote,
	getExportDefaultFileName,
	getExporter,
	getImporterDialogFilters,
	importFiles,
	type TransferFormat,
} from "@cortex/import-export"
import { getPlatform } from "@cortex/platform"
import { reportAppError } from "@/utils/reportAppError"

type ImportExportSource = "command-palette" | "settings" | "context-menu"

const exportFormatLabels: Record<TransferFormat, string> = {
	csv: "CSV",
	html: "HTML",
	pdf: "PDF",
}

export const noteExportFormats: Array<{ id: TransferFormat; label: string }> = [
	{ id: "html", label: "HTML" },
	{ id: "pdf", label: "PDF" },
	{ id: "csv", label: "CSV" },
]

function getImportSummaryMessage(importedCount: number, skippedCount: number, failedCount: number) {
	const parts = [`${importedCount} imported`]
	if (skippedCount > 0) parts.push(`${skippedCount} skipped`)
	if (failedCount > 0) parts.push(`${failedCount} failed`)
	return parts.join(", ")
}

export async function importFilesFromDialog(source: ImportExportSource): Promise<void> {
	const platform = getPlatform()
	const vaultState = useVaultStore.getState()
	const vaultPath = vaultState.vault?.path
	if (!vaultPath) return

	try {
		const filters = getImporterDialogFilters()
		const sourcePaths = await platform.dialog.pickFiles({
			title: "Import files",
			filters: [
				{
					name: "Supported import files",
					extensions: Array.from(new Set(filters.flatMap((filter) => filter.extensions))),
				},
				...filters,
			],
		})
		if (sourcePaths.length === 0) return

		const result = await importFiles({
			vaultPath,
			sourcePaths,
			existingFiles: vaultState.files,
		})
		await vaultState.refreshFiles()
		await platform.dialog.showAlert({
			title: "Import complete",
			message: getImportSummaryMessage(
				result.importedCount,
				result.skippedCount,
				result.failedCount,
			),
			kind: result.failedCount > 0 ? "warning" : "info",
		})
	} catch (error) {
		await reportAppError({
			operation: "import-files",
			source,
			cause: error,
			userMessage: "The selected files could not be imported.",
		})
	}
}

export async function exportNoteFromDialog(
	filePath: string,
	format: TransferFormat,
	source: ImportExportSource,
): Promise<void> {
	const platform = getPlatform()
	const exporter = getExporter(format)
	if (!exporter) return

	try {
		await noteCache.flush(filePath)
		const targetPath = await platform.dialog.saveFile({
			title: `Export ${exportFormatLabels[format]}`,
			defaultPath: `${filePath.slice(0, filePath.lastIndexOf("/"))}/${getExportDefaultFileName(
				filePath,
				exporter,
			)}`,
			filters: [{ name: exportFormatLabels[format], extensions: [exporter.extension] }],
		})
		if (!targetPath) return

		await exportNote({
			sourcePath: filePath,
			format,
			targetPath: targetPath ?? undefined,
		})
	} catch (error) {
		await reportAppError({
			operation: "export-note",
			source,
			cause: error,
			userMessage: "The note could not be exported.",
			context: { filePath, format },
		})
	}
}
