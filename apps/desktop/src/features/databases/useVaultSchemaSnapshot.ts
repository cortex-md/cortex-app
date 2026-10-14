import { useVaultStore } from "@cortex/core"
import {
	getVaultSchemaSnapshot,
	subscribeVaultSchemaSnapshot,
	type VaultSchema,
} from "@cortex/properties"
import { useCallback, useSyncExternalStore } from "react"

export { setVaultSchemaSnapshot } from "@cortex/properties"

export function useVaultSchemaSnapshot(): VaultSchema {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const subscribeToVault = useCallback(
		(listener: () => void) => subscribeVaultSchemaSnapshot(vaultPath, listener),
		[vaultPath],
	)
	const getSnapshot = useCallback(() => getVaultSchemaSnapshot(vaultPath), [vaultPath])
	return useSyncExternalStore(subscribeToVault, getSnapshot)
}
