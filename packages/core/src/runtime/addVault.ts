import {
	getPlatform,
	type RemoteVaultInfo,
	type SyncConfig,
	type SyncPreferences,
	type VaultRegistryEntry,
} from "@cortex/platform"
import { normalizeSyncPreferences } from "@cortex/platform/sync-rules"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import { useAuthStore } from "../stores/authStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import { useSubscriptionStore } from "../stores/subscriptionStore"
import { useVaultStore } from "../stores/vaultStore"
import { requiresCloudEntitlement, resolveSyncServerUrl } from "../sync/serverConfig"
import { readSyncConfig, unlinkRemoteVault, updateSyncConfig } from "../sync/syncConfig"
import { getVaultDisplayPath } from "./vaultDisplay"

export const VAULT_COLORS = [
	"#fb7185",
	"#d97706",
	"#16a34a",
	"#0d9488",
	"#0ea5e9",
	"#7c3aed",
	"#64748b",
] as const

export type VaultListStatus = "synced" | "paused" | "local" | "missing"

export interface VaultListItem {
	entry: VaultRegistryEntry
	color: string
	status: VaultListStatus
	remoteVaultId: string | null
	syncConfig: SyncConfig | null
}

export interface RegisterVaultFolderOptions {
	name: string
	color?: string | null
	icon?: string | null
	syncPreferences?: SyncPreferences
}

export function resolveVaultColor(entry: Pick<VaultRegistryEntry, "uuid" | "color">): string {
	if (entry.color) return entry.color
	let hash = 0
	for (const char of entry.uuid) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
	return VAULT_COLORS[hash % VAULT_COLORS.length] ?? VAULT_COLORS[0]
}

export function resolveVaultListStatus(
	exists: boolean,
	config: SyncConfig | null,
): VaultListStatus {
	if (!exists) return "missing"
	if (!config?.remoteVaultId) return "local"
	return config.enabled ? "synced" : "paused"
}

export async function loadVaultListItems(
	entries: readonly VaultRegistryEntry[],
): Promise<VaultListItem[]> {
	const vault = getPlatform().vault
	return await Promise.all(
		entries.map(async (entry) => {
			const exists = vault.pathExists ? await vault.pathExists(entry.path).catch(() => false) : true
			const syncConfig = exists ? await readSyncConfig(entry.path).catch(() => null) : null
			return {
				entry,
				color: resolveVaultColor(entry),
				status: resolveVaultListStatus(exists, syncConfig),
				remoteVaultId: syncConfig?.remoteVaultId ?? null,
				syncConfig,
			}
		}),
	)
}

export async function getDefaultVaultLocation(): Promise<string | null> {
	return (await getPlatform().vault.getDefaultVaultLocation?.()) ?? null
}

export async function createVaultFolder(parentPath: string | null, name: string): Promise<string> {
	const vault = getPlatform().vault
	if (!vault.createVaultFolder) throw new Error("Creating vault folders is not supported here.")
	return await vault.createVaultFolder(parentPath, name)
}

export async function registerVaultFolder(
	folderPath: string,
	{ name, color, icon, syncPreferences }: RegisterVaultFolderOptions,
): Promise<VaultRegistryEntry> {
	const vaultName = name.trim()
	if (!vaultName) throw new Error("Vault name cannot be empty.")
	const platform = getPlatform()
	const metadata = await platform.vault.getVaultMetadata(folderPath)
	await platform.vault.updateVaultRegistry(metadata.uuid, metadata.path, vaultName, icon)
	if (color) await platform.vault.patchVaultRegistry?.(metadata.uuid, { color })
	if (syncPreferences) {
		await platform.fs.writeFile(
			getVaultFilePath(metadata.path, VAULT_FILES.syncPreferences),
			JSON.stringify(normalizeSyncPreferences(syncPreferences), null, "\t"),
		)
	}
	await useVaultStore.getState().loadRecentVaults()
	const entry = useVaultStore.getState().recentVaults.find((item) => item.uuid === metadata.uuid)
	return (
		entry ?? {
			uuid: metadata.uuid,
			path: metadata.path,
			name: vaultName,
			lastOpened: Date.now(),
			icon: icon ?? null,
			color: color ?? null,
		}
	)
}

export async function linkVaultFolder(folderPath: string, remoteVaultId: string): Promise<void> {
	const remoteStore = useRemoteVaultStore.getState()
	const current = useVaultStore.getState().vault?.path ?? null
	if (current === folderPath) {
		await remoteStore.linkVault(folderPath, remoteVaultId)
		await remoteStore.setSyncEnabled(folderPath, true)
		return
	}
	const { selfHosted, serverUrl, selfHostedEnvironment } = remoteStore.syncConfig
	if (requiresCloudEntitlement({ selfHosted })) {
		await useSubscriptionStore
			.getState()
			.ensureCloudEntitlement(resolveSyncServerUrl({ selfHosted, serverUrl }))
	}
	await updateSyncConfig(folderPath, {
		enabled: true,
		remoteVaultId,
		selfHosted,
		serverUrl,
		selfHostedEnvironment,
	})
}

export async function unlinkVaultFolder(folderPath: string): Promise<void> {
	if (useVaultStore.getState().vault?.path === folderPath) {
		await useRemoteVaultStore.getState().unlinkVault(folderPath)
		return
	}
	await unlinkRemoteVault(folderPath)
}

export async function leaveRemoteVault(remoteVaultId: string): Promise<void> {
	const userId = useAuthStore.getState().user?.userId
	if (!userId) throw new Error("Sign in to leave this vault.")
	await getPlatform().members.removeMember(remoteVaultId, userId)
	await useRemoteVaultStore.getState().fetchRemoteVaults()
}

export interface RemoteVaultOption {
	remote: RemoteVaultInfo
	description: string
	takenBy: VaultListItem | null
}

function capitalize(value: string): string {
	return value ? value[0]?.toUpperCase() + value.slice(1) : value
}

export function describeRemoteVault(remote: RemoteVaultInfo): string {
	const members = remote.memberCount ?? 1
	const memberLabel = members === 1 ? "only you" : `${members} members`
	if (remote.role === "owner") return members === 1 ? "Yours · only you" : `Yours · ${memberLabel}`
	return `Shared with you · ${capitalize(remote.role)} · ${memberLabel}`
}

export function buildRemoteVaultOptions(
	remoteVaults: readonly RemoteVaultInfo[],
	localItems: readonly VaultListItem[],
	deviceLabel: string,
): RemoteVaultOption[] {
	return remoteVaults.map((remote) => {
		const takenBy = localItems.find((item) => item.remoteVaultId === remote.id) ?? null
		return {
			remote,
			takenBy,
			description: takenBy
				? `Already on this ${deviceLabel} at ${getVaultDisplayPath(takenBy.entry)}`
				: describeRemoteVault(remote),
		}
	})
}
