import { useRemoteVaultStore, useSyncStore, useVaultStore } from "@cortex/core"

export async function reloadSyncConflicts(): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	const vaultId = useRemoteVaultStore.getState().linkedVaultId
	if (!vaultPath || !vaultId) return
	await useSyncStore.getState().loadConflicts(vaultId, vaultPath)
}
