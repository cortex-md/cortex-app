import type {
	FileEntry,
	Vault as IVault,
	VaultMetadata,
	VaultRegistryEntry,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Vault implements IVault {
	async openVault(path: string): Promise<VaultMetadata> {
		return await invoke<VaultMetadata>("open_vault", { path })
	}

	async scanVault(path: string): Promise<FileEntry[]> {
		return await invoke<FileEntry[]>("scan_vault", { path })
	}

	async getVaultMetadata(path: string): Promise<VaultMetadata> {
		return await invoke<VaultMetadata>("get_vault_metadata", { path })
	}

	async readVaultRegistry(): Promise<VaultRegistryEntry[]> {
		return await invoke<VaultRegistryEntry[]>("read_vault_registry")
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
