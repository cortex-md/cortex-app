import {
	applyVaultSettingsImport,
	getBaseName,
	isPathOrDescendant,
	joinPath,
	reportAppError,
	useVaultStore,
	type VaultSettingsImportResult,
} from "@cortex/core"
import {
	analyzeObsidianVault,
	importObsidianVault,
	isObsidianVault,
	type ObsidianImportResult,
	type ObsidianProgress,
} from "@cortex/import-export"
import { getPlatform } from "@cortex/platform"
import { type ObsidianImportTarget, obsidianImportModal } from "./obsidianImportModal"

export interface ObsidianRunOptions {
	destinationFolder: string
	applyVaultSettings: boolean
	onProgress: (progress: ObsidianProgress) => void
	signal: AbortSignal
}

export interface ObsidianRunSummary {
	result: ObsidianImportResult
	applied: VaultSettingsImportResult | null
}

function getUniqueFolderName(name: string): string {
	const { vault, files } = useVaultStore.getState()
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

export async function importObsidianVaultFromDialog(): Promise<void> {
	const vault = useVaultStore.getState().vault
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
		obsidianImportModal.open({
			mode: "import",
			sourcePath,
			defaultFolder: getUniqueFolderName(getBaseName(sourcePath)),
		})
	} catch (error) {
		await reportAppError({
			operation: "import-obsidian",
			source: "command-palette",
			cause: error,
			userMessage: "The Obsidian vault could not be imported.",
		})
	}
}

export async function runObsidianImport(
	target: ObsidianImportTarget,
	options: ObsidianRunOptions,
): Promise<ObsidianRunSummary | null> {
	const vaultState = useVaultStore.getState()
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
	if (target.mode === "import") await useVaultStore.getState().refreshFiles()
	if (result.cancelled) return { result, applied: null }
	const applied = await applyVaultSettingsImport(vault, result.settings, {
		applyVaultSettings: options.applyVaultSettings,
	})
	return { result, applied }
}
