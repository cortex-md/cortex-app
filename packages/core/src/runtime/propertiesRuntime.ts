import { type DeviceInfo, getPlatform, type Platform } from "@cortex/platform"
import { isMarkdownPath, toVaultRelativePath } from "@cortex/platform/utils"
import {
	initializeProperties,
	type NoteSourceMetadata,
	type PropertiesRuntime,
	type PropertyAuthorContext,
} from "@cortex/properties"
import { noteCache } from "../noteCache"
import { mutateNote } from "../notes/mutateNote"
import { assertVaultPathWritable } from "../stores/accessStore"
import { useAuthStore } from "../stores/authStore"
import { useDevicesStore } from "../stores/devicesStore"
import { useMembersStore } from "../stores/membersStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import { useVaultStore } from "../stores/vaultStore"

export interface PropertiesRuntimeOptions {
	deviceType: string
	createId?: () => string
}

function getMetadataTimestamp(value: string | null | undefined): number {
	return value ? Date.parse(value) || 0 : 0
}

function loadDeviceInfo(platform: Platform, deviceType: string): Promise<DeviceInfo> {
	return platform.device.getDeviceInfo().catch(async () => ({
		deviceId: await platform.device.getDeviceId(),
		deviceName: "This device",
		deviceType,
	}))
}

function createLocalSourceMetadata(
	createdAt: number,
	modifiedAt: number,
	deviceId: string,
	dirty: boolean,
): NoteSourceMetadata {
	return {
		source: "local",
		synced: false,
		dirty,
		createdAt: new Date(createdAt).toISOString(),
		createdBy: `device:${deviceId}`,
		lastEditedAt: new Date(modifiedAt).toISOString(),
		lastEditedBy: `device:${deviceId}`,
	}
}

export function createPropertiesRuntime(options: PropertiesRuntimeOptions): PropertiesRuntime {
	const platform = getPlatform()
	const deviceInfoLoad = loadDeviceInfo(platform, options.deviceType)
	const noteMetadataLoads = new Map<string, ReturnType<Platform["sync"]["getNoteMetadata"]>>()
	let devicesLoad: Promise<void> | null = null

	const ensureDevices = (): Promise<void> => {
		devicesLoad ??= useDevicesStore
			.getState()
			.fetchDevices()
			.catch((error) => {
				devicesLoad = null
				throw error
			})
		return devicesLoad
	}

	const loadRemoteNoteMetadata = (
		vaultPath: string,
		relativePath: string,
		remoteVaultId: string,
	) => {
		const cacheKey = `${remoteVaultId}:${relativePath}`
		let load = noteMetadataLoads.get(cacheKey)
		if (!load) {
			load = platform.sync
				.getNoteMetadata(vaultPath, relativePath)
				.finally(() => noteMetadataLoads.delete(cacheKey))
			noteMetadataLoads.set(cacheKey, load)
		}
		return load.catch(() => null)
	}

	const getAuthorContext = async (): Promise<PropertyAuthorContext> => {
		const deviceInfo = await deviceInfoLoad
		try {
			const config = useRemoteVaultStore.getState().syncConfig
			const auth = useAuthStore.getState()
			if (config.remoteVaultId && auth.authenticated) {
				await Promise.all([
					useMembersStore
						.getState()
						.ensureMembers(config.remoteVaultId, config.serverUrl ?? undefined),
					ensureDevices(),
				])
			}
			const members = useMembersStore.getState().members
			const devices = useDevicesStore.getState().deviceEntries
			return {
				authenticated: auth.authenticated,
				remoteVaultId: config.remoteVaultId,
				currentUserId: auth.user?.userId ?? null,
				members: members.map((member) => ({
					id: member.userId,
					label: member.displayName || member.email,
					email: member.email,
					avatarUrl: member.avatarUrl,
				})),
				currentDeviceId: deviceInfo.deviceId,
				devices: devices.map((device) => ({
					id: device.id,
					label: device.deviceName,
					current: device.isCurrent ?? device.id === deviceInfo.deviceId,
				})),
			}
		} catch {
			return {
				authenticated: false,
				remoteVaultId: null,
				currentUserId: null,
				members: [],
				currentDeviceId: deviceInfo.deviceId,
				devices: [{ id: deviceInfo.deviceId, label: deviceInfo.deviceName, current: true }],
			}
		}
	}

	const getNoteSourceMetadata = async (filePath: string): Promise<NoteSourceMetadata> => {
		const entry = noteCache.getEntry(filePath)
		const [fileMetadata, deviceInfo] = await Promise.all([
			entry?.metadata ?? platform.fs.getFileMetadata(filePath),
			deviceInfoLoad,
		])
		const dirty = entry?.dirty ?? false
		const localMetadata = createLocalSourceMetadata(
			fileMetadata.createdAt,
			fileMetadata.modifiedAt,
			deviceInfo.deviceId,
			dirty,
		)
		const vaultPath = useVaultStore.getState().vault?.path
		const config = useRemoteVaultStore.getState().syncConfig
		const relativePath = vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
		if (!vaultPath || !relativePath || !config.enabled || !config.remoteVaultId) {
			return localMetadata
		}
		const remote = await loadRemoteNoteMetadata(vaultPath, relativePath, config.remoteVaultId)
		if (!remote) return localMetadata
		const remoteUpdatedAt = Math.max(
			getMetadataTimestamp(remote.lastEditedAt),
			getMetadataTimestamp(remote.createdAt),
		)
		const localCreatedAt = entry?.localCreatedAt ?? 0
		if (localCreatedAt > 0 && remoteUpdatedAt < localCreatedAt) return localMetadata
		return {
			source: "remote",
			synced: remote.synced,
			dirty,
			createdAt: remote.createdAt,
			createdBy: remote.createdBy,
			lastEditedAt: remote.lastEditedAt,
			lastEditedBy:
				remote.lastEditedBy ?? (remote.lastDeviceId ? `device:${remote.lastDeviceId}` : null),
		}
	}

	return {
		createId: options.createId,
		files: {
			readFile: (path) => platform.fs.readFile(path),
			atomicWriteFile: (path, content) => platform.fs.atomicWriteFile(path, content),
		},
		notes: {
			readNote: (path) => {
				const entry = noteCache.getEntry(path)
				return entry ? Promise.resolve(entry.content) : platform.fs.readFile(path)
			},
			updateNote: async (path, update) => {
				assertVaultPathWritable(path)
				await mutateNote(path, update)
			},
			resolveVaultPath: (filePath) => {
				const vaultPath = useVaultStore.getState().vault?.path
				return vaultPath && toVaultRelativePath(filePath, vaultPath) ? vaultPath : null
			},
			listMarkdownFiles: async () =>
				useVaultStore
					.getState()
					.files.flatMap((file) => (!file.isDir && isMarkdownPath(file.path) ? [file.path] : [])),
		},
		identity: { getAuthorContext },
		metadata: { getNoteSourceMetadata },
	}
}

export function initializeCoreProperties(options: PropertiesRuntimeOptions): void {
	initializeProperties(createPropertiesRuntime(options))
}
