import {
	createSyncEnvironmentSecretKey,
	formatLastSyncedAt,
	getSyncServerLabel,
	SELF_HOSTED_ENVIRONMENT_FIELDS,
	type SyncLogEntry,
	type SyncLogItem,
	serializeSelfHostedEnvironment,
	useRemoteVaultStore,
	useSyncLogStore,
	useSyncStore,
} from "@cortex/core"
import type { DeviceEntry, FileEntry, RemoteVaultInfo, SyncConfig } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Share } from "react-native"

import {
	CURRENT_DEVICE_NAME,
	type ExcludedPathEntry,
	type LinkedRemoteVault,
	NEW_REMOTE_VAULT_OPTION,
	type RemoteVaultLinkOption,
	type SyncDevice,
} from "@/features/sync/syncTypes"

export interface SyncMenuHeader {
	lastSynced: string
	server: string
}

export function getSyncMenuHeader(): SyncMenuHeader {
	return {
		lastSynced: formatLastSyncedAt(useSyncStore.getState().lastSyncedAt),
		server: getSyncServerLabel(useRemoteVaultStore.getState().syncConfig),
	}
}

export async function syncNow(): Promise<void> {
	const sync = useSyncStore.getState()
	if (sync.engineState === "idle") return
	await sync.restartSync()
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1)
}

function toLinkedRemoteVault(remote: RemoteVaultInfo, config: SyncConfig): LinkedRemoteVault {
	return {
		id: remote.id,
		name: remote.name,
		serverLabel: getSyncServerLabel(config),
		role: capitalize(remote.role),
		memberCount: remote.memberCount ?? 1,
	}
}

export function resolveLinkedRemoteVault(
	remoteVaults: readonly RemoteVaultInfo[],
	linkedVaultId: string | null,
	config: SyncConfig,
): LinkedRemoteVault | null {
	if (!linkedVaultId) return null
	const remote = remoteVaults.find((vault) => vault.id === linkedVaultId)
	if (remote) return toLinkedRemoteVault(remote, config)
	return {
		id: linkedVaultId,
		name: "Remote vault",
		serverLabel: getSyncServerLabel(config),
		role: "Member",
		memberCount: 1,
	}
}

export function getRemoteVaultLinkOptions(
	remoteVaults: readonly RemoteVaultInfo[],
	linkedVaultId: string | null,
): RemoteVaultLinkOption[] {
	const options = remoteVaults.map((remote): RemoteVaultLinkOption => {
		const members = remote.memberCount ?? 1
		const taken = remote.id === linkedVaultId
		const base = `${members} ${members === 1 ? "member" : "members"} · ${capitalize(remote.role)}`
		return {
			id: remote.id,
			name: remote.name,
			description: taken ? `${base} · linked to this vault` : base,
			encrypted: remote.hasKey,
			taken,
			isNew: false,
		}
	})
	return [...options, NEW_REMOTE_VAULT_OPTION]
}

export async function unlinkRemoteVault(vaultPath: string): Promise<void> {
	await useRemoteVaultStore.getState().unlinkVault(vaultPath)
}

export function listSyncDevices(
	deviceEntries: readonly DeviceEntry[],
	lastSyncedAt: number | null,
): SyncDevice[] {
	return deviceEntries
		.filter((device) => !device.revoked)
		.map((device) => ({
			id: device.id,
			name: device.deviceName || CURRENT_DEVICE_NAME,
			lastSyncedLabel: device.isCurrent
				? formatLastSyncedAt(lastSyncedAt)
				: device.lastSeenAt
					? formatLastSyncedAt(Date.parse(device.lastSeenAt))
					: "Not synced yet",
			isCurrent: Boolean(device.isCurrent),
		}))
}

export function countSyncedNotes(files: readonly FileEntry[]): number {
	return files.filter((entry) => !entry.isDir && /\.md$/i.test(entry.name)).length
}

export function getSyncLogEntries(entries: readonly SyncLogEntry[]): SyncLogEntry[] {
	return [...entries]
}

export function clearSyncLog(): void {
	useSyncLogStore.getState().clear()
}

export function formatSyncLogTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	})
}

export async function copySyncLog(items: readonly SyncLogItem[]): Promise<void> {
	const text = items
		.map((item) => {
			const paths = item.paths.length ? ` (${item.paths.join(", ")})` : ""
			const detail = item.detail ? ` — ${item.detail}` : ""
			return `${formatSyncLogTime(item.timestamp)} [${item.level}] ${item.title}${paths}${detail}`
		})
		.join("\n")
	await getPlatform().clipboard.writeText(text)
}

export function inferExcludeKind(value: string): ExcludedPathEntry["kind"] {
	if (value.includes("*")) return "Pattern"
	if (/\.md$/i.test(value)) return "File"
	return "Folder"
}

export function resolveExcludedPaths(excludedPaths: readonly string[]): ExcludedPathEntry[] {
	return excludedPaths.map((value) => ({ value, kind: inferExcludeKind(value) }))
}

export async function setExcludedPath(relativePath: string, excluded: boolean): Promise<void> {
	await useSyncStore.getState().toggleExcludedPath(relativePath, excluded)
}

export async function loadSelfHostedSecrets(vaultId: string): Promise<Record<string, string>> {
	const keychain = getPlatform().keychain
	const secretFields = SELF_HOSTED_ENVIRONMENT_FIELDS.filter((field) => field.secret)
	const values = await Promise.all(
		secretFields.map((field) => keychain.get(createSyncEnvironmentSecretKey(vaultId, field.key))),
	)
	const secrets: Record<string, string> = {}
	secretFields.forEach((field, index) => {
		const value = values[index]
		if (value) secrets[field.key] = value
	})
	return secrets
}

export async function saveSelfHostedSecret(
	vaultId: string,
	fieldKey: string,
	value: string,
): Promise<void> {
	const keychain = getPlatform().keychain
	const key = createSyncEnvironmentSecretKey(vaultId, fieldKey)
	if (value.trim()) await keychain.set(key, value)
	else await keychain.delete(key)
}

export function buildEnvironmentFile(
	values: Record<string, string>,
	secrets: Record<string, string>,
): string {
	return serializeSelfHostedEnvironment(values, secrets)
}

export async function copyEnvironmentFile(
	values: Record<string, string>,
	secrets: Record<string, string>,
): Promise<void> {
	await getPlatform().clipboard.writeText(buildEnvironmentFile(values, secrets))
}

export async function exportEnvironmentFile(
	values: Record<string, string>,
	secrets: Record<string, string>,
): Promise<void> {
	await Share.share({ message: buildEnvironmentFile(values, secrets), title: ".env" })
}
