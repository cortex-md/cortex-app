import {
	applyVaultSettingsImport,
	noteCache,
	reportAppError,
	useVaultStore,
	type VaultSettingsImportResult,
} from "@cortex/core"
import {
	importObsidianVaultFromDialog as importWithHost,
	type ObsidianImportHost,
	type ObsidianRunOptions,
	runObsidianImport as runWithHost,
	type ObsidianRunSummary as SharedObsidianRunSummary,
} from "@cortex/import-export"
import { type ObsidianImportTarget, obsidianImportModal } from "./obsidianImportModal"

export type { ObsidianRunOptions }

export type ObsidianRunSummary = SharedObsidianRunSummary<VaultSettingsImportResult>

const obsidianImportHost: ObsidianImportHost<VaultSettingsImportResult> = {
	getVaultState: () => useVaultStore.getState(),
	flushNote: (filePath) => noteCache.flush(filePath),
	reportError: (error) => reportAppError(error),
	openImportDialog: (target) => obsidianImportModal.open(target),
	applyVaultSettings: (vault, settings, options) =>
		applyVaultSettingsImport(vault, settings, options),
}

export function importObsidianVaultFromDialog(): Promise<void> {
	return importWithHost(obsidianImportHost)
}

export function runObsidianImport(
	target: ObsidianImportTarget,
	options: ObsidianRunOptions,
): Promise<ObsidianRunSummary | null> {
	return runWithHost(obsidianImportHost, target, options)
}
