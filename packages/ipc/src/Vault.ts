import type {
	FileEntry,
	Vault as IVault,
	VaultMetadata,
	VaultRegistryEntry,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"
import { normalizeFileEntries, normalizeVaultMetadata, normalizeVaultRegistryEntry } from "./path"

export class Vault implements IVault {
	async openVault(path: string): Promise<VaultMetadata> {
		const metadata = await invoke<VaultMetadata>("open_vault", { path })
		return normalizeVaultMetadata(metadata)
	}

	async scanVault(path: string): Promise<FileEntry[]> {
		const entries = await invoke<FileEntry[]>("scan_vault", { path })
		return normalizeFileEntries(entries)
	}

	async getVaultMetadata(path: string): Promise<VaultMetadata> {
		const metadata = await invoke<VaultMetadata>("get_vault_metadata", { path })
		return normalizeVaultMetadata(metadata)
	}

	async readVaultRegistry(): Promise<VaultRegistryEntry[]> {
		const entries = await invoke<VaultRegistryEntry[]>("read_vault_registry")
		return entries.map(normalizeVaultRegistryEntry)
	}

	async updateVaultRegistry(
		uuid: string,
		path: string,
		name: string,
		icon?: string | null,
		color?: string | null,
	): Promise<void> {
		await invoke<void>("update_vault_registry", {
			uuid,
			path,
			name,
			icon: icon ?? null,
			color: color ?? null,
		})
	}

	async removeFromVaultRegistry(uuid: string): Promise<void> {
		await invoke<void>("remove_from_vault_registry", { uuid })
	}

	async refreshMenuRecents(): Promise<void> {
		await invoke<void>("refresh_menu_recents")
	}
}
