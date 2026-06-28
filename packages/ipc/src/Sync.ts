import type {
	ConflictInfo,
	ConflictResolution,
	DeletedFileInfo,
	InitialSyncProgressEvent,
	Sync as ISync,
	NoteSyncMetadata,
	SyncAccessDeniedEvent,
	SyncConflictEvent,
	SyncFileEvent,
	SyncPreferences,
	SyncStateEvent,
	VaultEncryptionStatus,
	VersionInfo,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import {
	normalizeConflictInfo,
	normalizeDeletedFileInfo,
	normalizeSyncConflictEvent,
	normalizeSyncFileEvent,
} from "./path"

function toRustResolution(resolution: ConflictResolution): unknown {
	switch (resolution.type) {
		case "keep_local":
			return "keep_local"
		case "keep_remote":
			return "keep_remote"
		case "merged":
			return { merged: { content: resolution.content } }
	}
}

export class Sync implements ISync {
	async updateSyncPreferences(preferences: SyncPreferences): Promise<void> {
		await invoke<void>("sync_update_preferences", {
			syncSettings: preferences.syncSettings,
			syncHotkeys: preferences.syncHotkeys,
			syncWorkspace: preferences.syncWorkspace,
			syncPluginMetadata: preferences.syncPluginMetadata,
			syncThemeMetadata: preferences.syncThemeMetadata,
			syncBookmarks: preferences.syncBookmarks,
			ignoreImages: preferences.ignoreImages,
			excludedPaths: preferences.excludedPaths,
		})
	}

	async checkVaultEncryption(vaultId: string): Promise<VaultEncryptionStatus> {
		return await invoke<VaultEncryptionStatus>("sync_check_vault_encryption", { vaultId })
	}

	async createVaultKey(vaultId: string, password: string): Promise<void> {
		await invoke<void>("sync_create_vault_key", { vaultId, password })
	}

	async unlockVaultKey(vaultId: string, password: string): Promise<void> {
		await invoke<void>("sync_unlock_vault_key", { vaultId, password })
	}

	async start(
		vaultId: string,
		vaultPath: string,
		serverUrl: string,
		requiresEntitlement: boolean,
	): Promise<void> {
		await invoke<void>("sync_start", { vaultId, vaultPath, serverUrl, requiresEntitlement })
	}

	async stop(): Promise<void> {
		await invoke<void>("sync_stop")
	}

	async forceSyncFile(path: string): Promise<void> {
		await invoke<void>("sync_force_sync_file", { path })
	}

	async resolveConflict(path: string, resolution: ConflictResolution): Promise<void> {
		await invoke<void>("sync_resolve_conflict", {
			path,
			resolution: toRustResolution(resolution),
		})
	}

	async getConflicts(vaultId: string, vaultPath: string): Promise<ConflictInfo[]> {
		const conflicts = await invoke<ConflictInfo[]>("sync_get_conflicts", {
			vaultId,
			vaultPath,
		})
		return conflicts.map(normalizeConflictInfo)
	}

	async getVersionHistory(
		vaultId: string,
		vaultPath: string,
		filePath: string,
	): Promise<VersionInfo[]> {
		return await invoke<VersionInfo[]>("sync_get_version_history", {
			vaultId,
			vaultPath,
			filePath,
		})
	}

	async getNoteMetadata(vaultPath: string, filePath: string): Promise<NoteSyncMetadata | null> {
		return await invoke<NoteSyncMetadata | null>("sync_get_note_metadata", {
			vaultPath,
			filePath,
		})
	}

	async downloadVersion(
		vaultId: string,
		vaultPath: string,
		filePath: string,
		version: string,
	): Promise<string> {
		return await invoke<string>("sync_download_version", {
			vaultId,
			vaultPath,
			filePath,
			version,
		})
	}

	async restoreVersion(
		vaultId: string,
		vaultPath: string,
		filePath: string,
		version: string,
	): Promise<void> {
		await invoke<void>("sync_restore_version", {
			vaultId,
			vaultPath,
			filePath,
			version,
		})
	}

	async listDeletedFiles(vaultId: string, vaultPath: string): Promise<DeletedFileInfo[]> {
		const files = await invoke<DeletedFileInfo[]>("sync_list_deleted_files", {
			vaultId,
			vaultPath,
		})
		return files.map(normalizeDeletedFileInfo)
	}

	async restoreDeletedFile(vaultId: string, vaultPath: string, filePath: string): Promise<void> {
		await invoke<void>("sync_restore_deleted_file", {
			vaultId,
			vaultPath,
			filePath,
		})
	}

	async onStateChanged(callback: (event: SyncStateEvent) => void): Promise<() => void> {
		const unlisten = await listen<SyncStateEvent>("sync-state-changed", (e) => {
			callback(e.payload)
		})
		return unlisten
	}

	async onFileEvent(callback: (event: SyncFileEvent) => void): Promise<() => void> {
		const unlisten = await listen<SyncFileEvent>("sync-file-event", (e) => {
			callback(normalizeSyncFileEvent(e.payload))
		})
		return unlisten
	}

	async onInitialSyncProgress(
		callback: (event: InitialSyncProgressEvent) => void,
	): Promise<() => void> {
		const unlisten = await listen<InitialSyncProgressEvent>("sync-initial-progress", (e) => {
			callback(e.payload)
		})
		return unlisten
	}

	async onConflict(callback: (event: SyncConflictEvent) => void): Promise<() => void> {
		const unlisten = await listen<SyncConflictEvent>("sync-conflict", (e) => {
			callback(normalizeSyncConflictEvent(e.payload))
		})
		return unlisten
	}

	async onInitialSyncComplete(callback: () => void): Promise<() => void> {
		const unlisten = await listen("sync-initial-complete", () => {
			callback()
		})
		return unlisten
	}

	async onVekRequired(callback: () => void): Promise<() => void> {
		const unlisten = await listen("sync-vek-required", () => {
			callback()
		})
		return unlisten
	}

	async onVaultAccessDenied(callback: (event: SyncAccessDeniedEvent) => void): Promise<() => void> {
		const unlisten = await listen<SyncAccessDeniedEvent>("sync-vault-access-denied", (e) => {
			callback(e.payload)
		})
		return unlisten
	}

	async onSyncLog(
		callback: (event: { level: string; message: string }) => void,
	): Promise<() => void> {
		const unlisten = await listen<{ level: string; message: string }>("sync-log", (e) => {
			callback(e.payload)
		})
		return unlisten
	}
}
