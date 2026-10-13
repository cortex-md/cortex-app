import { useVaultStore } from "@cortex/core"
import type { VaultMetadata, VaultRegistryEntry } from "@cortex/platform"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

function isReadableName(name: string | null | undefined): name is string {
	return Boolean(name?.trim()) && !UUID_PATTERN.test(name?.trim() ?? "")
}

export function resolveVaultDisplayName(
	vault: VaultMetadata | null,
	recentVaults: readonly VaultRegistryEntry[],
): string {
	if (!vault) return "Vault"
	const entry = recentVaults.find((item) => item.uuid === vault.uuid || item.path === vault.path)
	if (isReadableName(entry?.name)) return entry.name.trim()
	if (isReadableName(vault.name)) return vault.name.trim()
	return "Vault"
}

export function getVaultDisplayName(): string {
	const { recentVaults, vault } = useVaultStore.getState()
	return resolveVaultDisplayName(vault, recentVaults)
}

export function useVaultDisplayName(): string {
	const vault = useVaultStore((state) => state.vault)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	return resolveVaultDisplayName(vault, recentVaults)
}
