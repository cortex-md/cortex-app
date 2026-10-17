import type { SyncPreferences, VaultMetadata, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import { resolveStoredVaultName } from "@cortex/platform/vault"
import { useSyncStore } from "../stores/syncStore"
import { type OpenVaultOptions, useVaultStore } from "../stores/vaultStore"

export const DEFAULT_VAULT_NAME = "My Vault"

export type PickedFolder =
	| { kind: "existing"; entry: VaultRegistryEntry }
	| { kind: "new"; path: string; defaultName: string }

export interface CreateVaultFromFolderOptions {
	name: string
	icon?: string
	syncPreferences: SyncPreferences
	createOnboardingNote?: boolean
}

export function getRegistryOpenOptions(entry: VaultRegistryEntry): OpenVaultOptions {
	return { name: entry.name, icon: entry.icon ?? undefined }
}

export async function openVaultSession(
	path: string,
	options?: OpenVaultOptions,
): Promise<VaultMetadata> {
	await useVaultStore.getState().switchVault(path, options)
	const { vault, error } = useVaultStore.getState()
	if (!vault) throw new Error(error ?? "Unable to open vault")
	return vault
}

export async function getDefaultVaultName(folderPath: string): Promise<string> {
	const vaultFile = await getPlatform()
		.fs.readFile(getVaultFilePath(folderPath, VAULT_FILES.vault))
		.catch(() => null)
	return resolveStoredVaultName(vaultFile, folderPath) || DEFAULT_VAULT_NAME
}

export async function resolvePickedFolder(folderPath: string): Promise<PickedFolder> {
	const entry = useVaultStore.getState().resolveFolderOpen(folderPath)
	if (entry) return { kind: "existing", entry }
	return { kind: "new", path: folderPath, defaultName: await getDefaultVaultName(folderPath) }
}

export async function createVaultFromFolder(
	folderPath: string,
	{ name, icon, syncPreferences, createOnboardingNote = true }: CreateVaultFromFolderOptions,
): Promise<VaultMetadata> {
	const vaultName = name.trim()
	if (!vaultName) throw new Error("Vault name cannot be empty.")
	const vault = await openVaultSession(folderPath, {
		name: vaultName,
		icon,
		createOnboardingNote,
	})
	await useSyncStore.getState().saveSyncPreferences(vault.path, syncPreferences)
	return vault
}

export function consumePendingOnboardingNote(open: (filePath: string) => void): void {
	const { pendingOnboardingNotePath, clearPendingOnboardingNotePath } = useVaultStore.getState()
	if (!pendingOnboardingNotePath) return
	clearPendingOnboardingNotePath()
	open(pendingOnboardingNotePath)
}
