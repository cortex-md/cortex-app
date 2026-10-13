import {
	CLOUD_SERVER_LABEL,
	createSyncEnvironmentSecretKey,
	formatLastSyncedAt,
	getSyncServerLabel,
	SELF_HOSTED_ENVIRONMENT_FIELDS,
	serializeSelfHostedEnvironment,
	type SyncLogEntry,
	type SyncLogItem,
	useRemoteVaultStore,
	useSyncLogStore,
	useSyncStore,
} from "@cortex/core"
import type { DeviceEntry, FileEntry, RemoteVaultInfo, SyncConfig } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Share } from "react-native"

import {
	createFixtureSyncLogEntries,
	CURRENT_DEVICE_NAME,
	type ExcludedPathEntry,
	FIXTURE_EXCLUDED_PATHS,
	FIXTURE_REMOTE_VAULT_OPTIONS,
	FIXTURE_REMOTE_VAULTS,
	FIXTURE_SYNC_DEVICES,
	type LinkedRemoteVault,
	NEW_REMOTE_VAULT_OPTION_ID,
	type RemoteVaultLinkOption,
	type SyncDevice,
} from "@/features/sync/syncFixtures"

export interface SyncMenuHeader {
	lastSynced: string
	server: string
}

export function getSyncMenuHeader(): SyncMenuHeader {
	// stub: the hosted sync server label comes from the remote vault config once sync runs on mobile
	return {
		lastSynced: formatLastSyncedAt(useSyncStore.getState().lastSyncedAt),
		server: CLOUD_SERVER_LABEL,
	}
}

export async function syncNow(): Promise<void> {
	// stub: the remote sync engine is not available on mobile yet; restart the local sync lifecycle
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
	// stub: fixture remote vaults stand in for the account's vaults until the sync API runs on mobile
	if (!linkedVaultId) return null
	const remote = remoteVaults.find((vault) => vault.id === linkedVaultId)
	if (remote) return toLinkedRemoteVault(remote, config)
	const fixture = FIXTURE_REMOTE_VAULTS.find((vault) => vault.id === linkedVaultId)
	if (fixture) return { ...fixture, serverLabel: getSyncServerLabel(config) }
	return {
		id: linkedVaultId,
		name: linkedVaultId.replace(/^remote-/, "").replace(/-/g, " "),
		serverLabel: getSyncServerLabel(config),
		role: "Owner",
		memberCount: 1,
	}
}

export function getRemoteVaultLinkOptions(
	remoteVaults: readonly RemoteVaultInfo[],
	linkedVaultId: string | null,
): RemoteVaultLinkOption[] {
	// stub: fixture remote vaults stand in for the account's vaults until the sync API runs on mobile
	if (remoteVaults.length === 0) {
		return FIXTURE_REMOTE_VAULT_OPTIONS.map((option) =>
			option.id === linkedVaultId
				? {
						...option,
						taken: true,
						description: `${option.description.split(" · linked")[0]} · linked to this vault`,
					}
				: option.id === "remote-work" && linkedVaultId
					? { ...option, taken: false, description: "4 members · Owner" }
					: option,
		)
	}
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
	const newOption = FIXTURE_REMOTE_VAULT_OPTIONS.find(
		(option) => option.id === NEW_REMOTE_VAULT_OPTION_ID,
	)
	return newOption ? [...options, newOption] : options
}

export async function linkRemoteVault(
	vaultPath: string,
	option: RemoteVaultLinkOption,
	newName: string,
): Promise<string> {
	// stub: the encryption password and upload are not sent anywhere; only the local link is written
	const store = useRemoteVaultStore.getState()
	let remoteVaultId = option.id
	if (option.isNew) {
		const trimmed = newName.trim() || "Notes"
		const hasRealVaults = store.remoteVaults.length > 0
		if (hasRealVaults) {
			const created = await store.createRemoteVault(trimmed, null)
			remoteVaultId = created.id
		} else {
			remoteVaultId = `remote-${trimmed.toLowerCase().replace(/\s+/g, "-")}`
		}
	}
	await store.linkVault(vaultPath, remoteVaultId)
	await store.setSyncEnabled(vaultPath, true)
	return remoteVaultId
}

export async function unlinkRemoteVault(vaultPath: string): Promise<void> {
	// stub: the remote copy is left untouched; only the local link is removed
	await useRemoteVaultStore.getState().unlinkVault(vaultPath)
}

export function listSyncDevices(
	deviceEntries: readonly DeviceEntry[],
	lastSyncedAt: number | null,
): SyncDevice[] {
	// stub: fixture devices stand in for the account's devices until the sync API runs on mobile
	const active = deviceEntries.filter((device) => !device.revoked)
	if (active.length === 0) return FIXTURE_SYNC_DEVICES
	return active.map((device) => ({
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

export function getSyncLogEntries(entries: readonly SyncLogEntry[], now: number): SyncLogEntry[] {
	// stub: fixture log entries stand in while the sync engine does not run on mobile
	return entries.length > 0 ? [...entries] : createFixtureSyncLogEntries(now)
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
	// stub: the fixture seed shows the editor until the vault has its own excludes
	if (excludedPaths.length === 0) return FIXTURE_EXCLUDED_PATHS
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
