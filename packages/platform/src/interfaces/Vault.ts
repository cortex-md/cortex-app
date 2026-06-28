import type { FileEntry } from "./FileSystem"

export type { FileEntry }

export interface VaultMetadata {
	uuid: string
	path: string
	name: string
	fileCount: number
}

export interface VaultRegistryEntry {
	uuid: string
	path: string
	name: string
	lastOpened: number
	icon: string | null
	color: string | null
}

export interface Vault {
	openVault(path: string): Promise<VaultMetadata>
	scanVault(path: string): Promise<FileEntry[]>
	getVaultMetadata(path: string): Promise<VaultMetadata>
	readVaultRegistry(): Promise<VaultRegistryEntry[]>
	updateVaultRegistry(
		uuid: string,
		path: string,
		name: string,
		icon?: string | null,
		color?: string | null,
	): Promise<void>
	removeFromVaultRegistry(uuid: string): Promise<void>
	refreshMenuRecents(): Promise<void>
}
