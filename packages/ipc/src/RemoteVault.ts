import type { RemoteVault as IRemoteVault, RemoteVaultInfo, SyncConfig } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class RemoteVault implements IRemoteVault {
	async create(name: string, description: string | null): Promise<RemoteVaultInfo> {
		return await invoke<RemoteVaultInfo>("remote_vault_create", {
			name,
			description,
		})
	}

	async list(): Promise<RemoteVaultInfo[]> {
		return await invoke<RemoteVaultInfo[]>("remote_vault_list")
	}

	async get(vaultId: string): Promise<RemoteVaultInfo> {
		return await invoke<RemoteVaultInfo>("remote_vault_get", { vaultId })
	}

	async update(
		vaultId: string,
		name: string | null,
		description: string | null,
	): Promise<RemoteVaultInfo> {
		return await invoke<RemoteVaultInfo>("remote_vault_update", {
			vaultId,
			name,
			description,
		})
	}

	async delete(vaultId: string): Promise<void> {
		await invoke<void>("remote_vault_delete", { vaultId })
	}

	async link(vaultPath: string, remoteVaultId: string): Promise<void> {
		await invoke<void>("remote_vault_link", { vaultPath, remoteVaultId })
	}

	async unlink(vaultPath: string): Promise<void> {
		await invoke<void>("remote_vault_unlink", { vaultPath })
	}

	async getLink(vaultPath: string): Promise<string | null> {
		return await invoke<string | null>("remote_vault_get_link", { vaultPath })
	}

	async readSyncConfig(vaultPath: string): Promise<SyncConfig> {
		return await invoke<SyncConfig>("sync_config_read", { vaultPath })
	}

	async updateSyncConfig(vaultPath: string, key: string, value: unknown): Promise<void> {
		await invoke<void>("sync_config_update", { vaultPath, key, value })
	}
}
