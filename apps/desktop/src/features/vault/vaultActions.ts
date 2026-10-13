import {
	getRegistryOpenOptions,
	type OpenVaultOptions,
	openVaultSession,
	reportAppError,
	useVaultStore,
} from "@cortex/core"
import { getPlatform, type VaultRegistryEntry } from "@cortex/platform"
import { createModalStore } from "@/utils/createModalStore"

export type AddVaultPath = "create" | "open" | "download"

export interface AddVaultTarget {
	start: "choose" | AddVaultPath
	remoteVaultId?: string
}

export const addVaultModal = createModalStore<AddVaultTarget>()

export function openAddVault(target: AddVaultTarget = { start: "choose" }): void {
	addVaultModal.open(target)
}

export type OpenVaultTarget = "auto" | "current-window" | "new-window"

export async function openRecentVault(
	entry: VaultRegistryEntry,
	target: OpenVaultTarget = "auto",
	options: Partial<OpenVaultOptions> = {},
): Promise<void> {
	try {
		const hasVault = useVaultStore.getState().vault !== null
		if (target === "new-window" || (target === "auto" && hasVault)) {
			await getPlatform().window.openVaultWindow(entry.path)
			return
		}
		await openVaultSession(entry.path, { ...getRegistryOpenOptions(entry), ...options })
	} catch (error) {
		await reportAppError({
			operation: "open-recent-vault",
			source: "vault-picker",
			cause: error,
			userMessage: `"${entry.name}" could not be opened.`,
		})
	}
}
