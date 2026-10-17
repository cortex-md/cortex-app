import { getVaultFilePath, VAULT_CONFIG_DIR } from "@cortex/platform/utils"
import { closeStateFiles, flushStateFiles } from "@cortex/platform/vault-state"

export {
	getLocalVaultState,
	getVaultSyncState,
	type LocalVaultState,
	type VaultSyncState,
} from "@cortex/platform/vault-state"

export async function flushVaultStateFiles(vaultPath: string): Promise<void> {
	await flushStateFiles(getVaultFilePath(vaultPath, VAULT_CONFIG_DIR))
}

export async function closeVaultStateFiles(vaultPath: string): Promise<void> {
	await closeStateFiles(getVaultFilePath(vaultPath, VAULT_CONFIG_DIR))
}
