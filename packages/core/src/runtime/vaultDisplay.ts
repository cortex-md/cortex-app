import type { VaultRegistryEntry } from "@cortex/platform"
import type { VaultListStatus } from "./addVault"

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

export function getVaultStatusTitles(deviceLabel: string): Record<VaultListStatus, string> {
	return {
		synced: "Local folder, synced",
		paused: "Local folder, sync paused",
		local: `Only on this ${deviceLabel}`,
		missing: "Folder not found",
	}
}
