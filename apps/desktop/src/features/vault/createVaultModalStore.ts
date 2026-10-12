import {
	getDefaultVaultName,
	getRegistryOpenOptions,
	openVaultSession,
	reportAppError,
	resolvePickedFolder,
	useVaultStore,
} from "@cortex/core"
import { getPlatform, type VaultRegistryEntry } from "@cortex/platform"
import { createModalStore } from "@/utils/createModalStore"

export interface CreateVaultTarget {
	folderPath: string
	defaultName: string
}

export type VaultFolderPickMode = "open" | "create"

export const createVaultModal = createModalStore<CreateVaultTarget>()

export async function pickVaultFolder(mode: VaultFolderPickMode): Promise<void> {
	try {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return
		if (mode === "create") {
			createVaultModal.open({ folderPath, defaultName: await getDefaultVaultName(folderPath) })
			return
		}
		const picked = await resolvePickedFolder(folderPath)
		if (picked.kind === "existing") {
			await openRecentVault(picked.entry)
			return
		}
		createVaultModal.open({ folderPath, defaultName: picked.defaultName })
	} catch (error) {
		await reportAppError({
			operation: "open-vault-folder",
			source: "vault-picker",
			cause: error,
			userMessage: "The vault could not be opened.",
		})
	}
}

export async function openRecentVault(
	entry: VaultRegistryEntry,
	target: "auto" | "current-window" = "auto",
): Promise<void> {
	try {
		if (target === "auto" && useVaultStore.getState().vault) {
			await getPlatform().window.openVaultWindow(entry.path)
			return
		}
		await openVaultSession(entry.path, getRegistryOpenOptions(entry))
	} catch (error) {
		await reportAppError({
			operation: "open-recent-vault",
			source: "vault-picker",
			cause: error,
			userMessage: `"${entry.name}" could not be opened.`,
		})
	}
}
