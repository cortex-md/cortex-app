import { useAppStore, useVaultStore, type OpenVaultOptions } from "@cortex/core"
import type { VaultMetadata } from "@cortex/platform"

import { writeLastActiveVaultPath } from "@/runtime/mobile-startup-state"

export async function openMobileVault(
	path: string,
	options?: OpenVaultOptions,
): Promise<VaultMetadata> {
	const vaultStore = useVaultStore.getState()
	const currentVault = vaultStore.vault

	if (currentVault && currentVault.path !== path) {
		await vaultStore.closeVault()
	}

	await useVaultStore.getState().openVault(path, options)

	const openedVault = useVaultStore.getState().vault
	if (!openedVault) {
		await writeLastActiveVaultPath(null).catch(() => {})
		throw new Error(useVaultStore.getState().error ?? "Unable to open vault")
	}

	await Promise.all([
		writeLastActiveVaultPath(openedVault.path),
		useAppStore.getState().markFirstRunOnboardingSeen(),
		useVaultStore.getState().loadRecentVaults(),
	])

	return openedVault
}
