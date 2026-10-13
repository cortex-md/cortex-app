import type { VaultListStatus } from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"

const HOME_PREFIX =
	/^(?:\/Users|\/home)\/[^/]+(?=\/|$)|^[A-Za-z]:[\\/]Users[\\/][^\\/]+(?=[\\/]|$)/u

export function formatVaultPath(path: string): string {
	return path.replace(HOME_PREFIX, "~")
}

export function getVaultDisplayPath(
	entry: Pick<VaultRegistryEntry, "path" | "displayPath">,
): string {
	return formatVaultPath(entry.displayPath ?? entry.path)
}

export function getVaultInitial(name: string): string {
	return (name.trim()[0] ?? "V").toUpperCase()
}

export const VAULT_STATUS_TITLE: Record<VaultListStatus, string> = {
	synced: "Local folder, synced",
	paused: "Local folder, sync paused",
	local: "Only on this Mac",
	missing: "Folder not found",
}
