import { noteCache, reportAppError, useVaultStore } from "@cortex/core"
import {
	exportNoteFromDialog as exportNoteWithHost,
	type ImportExportHost,
	type ImportExportSource,
	importFilesFromDialog as importFilesWithHost,
	type TransferFormat,
} from "@cortex/import-export"

export { noteExportFormats } from "@cortex/import-export"

const importExportHost: ImportExportHost = {
	getVaultState: () => useVaultStore.getState(),
	flushNote: (filePath) => noteCache.flush(filePath),
	reportError: (error) => reportAppError(error),
}

export function importFilesFromDialog(source: ImportExportSource): Promise<void> {
	return importFilesWithHost(importExportHost, source)
}

export function exportNoteFromDialog(
	filePath: string,
	format: TransferFormat,
	source: ImportExportSource,
): Promise<void> {
	return exportNoteWithHost(importExportHost, filePath, format, source)
}
