import { getPlatform } from "@cortex/platform"
import { getBaseName, isPathOrDescendant, joinPath } from "@cortex/platform/utils"
import type { ImportExportHost } from "./actions"
import { isObsidianVault } from "./obsidian/config"
import type { VaultSettingsImport } from "./obsidian/settings"
import {
	analyzeObsidianVault,
	importObsidianVault,
	type ObsidianImportResult,
	type ObsidianProgress,
} from "./obsidian/vault"

export interface ObsidianRunOptions {
	destinationFolder: string
	applyVaultSettings: boolean
	onProgress: (progress: ObsidianProgress) => void
	signal: AbortSignal
}

export interface ObsidianRunSummary<TApplied> {
	result: ObsidianImportResult
	applied: TApplied | null
}

export type ObsidianImportTarget =
	| { mode: "import"; sourcePath: string; defaultFolder: string }
	| { mode: "adopt" }

export interface ObsidianImportHost<TApplied> extends ImportExportHost {
	openImportDialog: (target: ObsidianImportTarget) => void
	applyVaultSettings: (
		vault: { path: string; name: string },
		settings: VaultSettingsImport,
		options: { applyVaultSettings: boolean },
	) => Promise<TApplied>
}

export function getUniqueFolderName(host: ImportExportHost, name: string): string {
	const { vault, files } = host.getVaultState()
	if (!vault) return name
	const taken = new Set(files.map((file) => file.path.toLocaleLowerCase()))
	let candidate = name
	let suffix = 2
	while (taken.has(joinPath(vault.path, candidate).toLocaleLowerCase())) {
		candidate = `${name} ${suffix}`
		suffix += 1
	}
	return candidate
}

export async function importObsidianVaultFromDialog<TApplied>(
	host: ObsidianImportHost<TApplied>,
): Promise<void> {
	const vault = host.getVaultState().vault
	if (!vault) return
	const platform = getPlatform()
	try {
		const sourcePath = await platform.dialog.pickFolder({ title: "Choose an Obsidian vault" })
		if (!sourcePath) return
		if (isPathOrDescendant(vault.path, sourcePath) || isPathOrDescendant(sourcePath, vault.path)) {
			await platform.dialog.showAlert({
				title: "Import from Obsidian",
				message: "Choose a folder that is outside the current vault.",
				kind: "warning",
			})
			return
		}
		if (!(await isObsidianVault(sourcePath))) {
			const confirmed = await platform.dialog.showConfirm({
				title: "Import from Obsidian",
				message: "This folder has no .obsidian configuration. Import its notes and files anyway?",
				confirmLabel: "Import",
			})
			if (!confirmed) return
		}
		host.openImportDialog({
			mode: "import",
			sourcePath,
			defaultFolder: getUniqueFolderName(host, getBaseName(sourcePath)),
		})
	} catch (error) {
		await host.reportError({
			operation: "import-obsidian",
			source: "command-palette",
			cause: error,
			userMessage: "The Obsidian vault could not be imported.",
		})
	}
}

export async function runObsidianImport<TApplied>(
	host: ObsidianImportHost<TApplied>,
	target: ObsidianImportTarget,
	options: ObsidianRunOptions,
): Promise<ObsidianRunSummary<TApplied> | null> {
	const vaultState = host.getVaultState()
	const vault = vaultState.vault
	if (!vault) return null
	const result =
		target.mode === "import"
			? await importObsidianVault({
					sourcePath: target.sourcePath,
					vaultPath: vault.path,
					destinationPath: joinPath(vault.path, options.destinationFolder),
					onProgress: options.onProgress,
					signal: options.signal,
				})
			: await analyzeObsidianVault({
					vaultPath: vault.path,
					files: vaultState.files,
					onProgress: options.onProgress,
					signal: options.signal,
				})
	if (target.mode === "import") await host.getVaultState().refreshFiles()
	if (result.cancelled) return { result, applied: null }
	const applied = await host.applyVaultSettings(vault, result.settings, {
		applyVaultSettings: options.applyVaultSettings,
	})
	return { result, applied }
}
