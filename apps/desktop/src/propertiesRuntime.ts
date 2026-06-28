import {
	noteCache,
	useAuthStore,
	useDevicesStore,
	useMembersStore,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { type DeviceInfo, getPlatform, type Platform } from "@cortex/platform"
import { initializeProperties } from "@cortex/properties"

let devicesLoaded = false
let devicesLoad: Promise<void> | null = null
let currentDeviceInfo: Promise<DeviceInfo> | undefined
const noteMetadataLoads = new Map<string, ReturnType<typeof loadRemoteNoteMetadata>>()

async function ensureDevices(): Promise<void> {
	if (devicesLoaded) return
	if (devicesLoad) return devicesLoad
	devicesLoad = useDevicesStore
		.getState()
		.fetchDevices()
		.then(() => {
			devicesLoaded = true
		})
		.finally(() => {
			devicesLoad = null
		})
	return devicesLoad
}

function loadRemoteNoteMetadata(vaultPath: string, relativePath: string) {
	return getPlatform().sync.getNoteMetadata(vaultPath, relativePath)
}

function getMetadataTimestamp(value: string | null | undefined): number {
	return value ? Date.parse(value) || 0 : 0
}

async function createFallbackDeviceInfo(platform: Platform): Promise<DeviceInfo> {
	return {
		deviceId: await platform.device.getDeviceId(),
		deviceName: "This device",
		deviceType: "desktop",
	}
}

function getCurrentDeviceInfo(platform: Platform): Promise<DeviceInfo> {
	currentDeviceInfo ??= platform.device
		.getDeviceInfo()
		.catch(() => createFallbackDeviceInfo(platform))
	return currentDeviceInfo
}

export function initializeDesktopProperties(): void {
	const platform = getPlatform()
	const deviceInfoLoad = getCurrentDeviceInfo(platform)
	initializeProperties({
		files: {
			readFile: (path) => platform.fs.readFile(path),
			atomicWriteFile: (path, content) => platform.fs.atomicWriteFile(path, content),
		},
		notes: {
			readNote: (path) => {
				const entry = noteCache.getEntry(path)
				return entry ? Promise.resolve(entry.content) : platform.fs.readFile(path)
			},
			writeNote: async (path, content) => {
				if (noteCache.getEntry(path)) {
					noteCache.writeExternal(path, content)
					return
				}
				await platform.fs.writeFile(path, content)
			},
			resolveVaultPath: (filePath) => {
				const vaultPath = useVaultStore.getState().vault?.path
				return vaultPath && filePath.startsWith(`${vaultPath}/`) ? vaultPath : null
			},
			listMarkdownFiles: async (_vaultPath) => {
				return useVaultStore
					.getState()
					.files.flatMap((file) =>
						!file.isDir && file.path.toLocaleLowerCase().endsWith(".md") ? [file.path] : [],
					)
			},
		},
		identity: {
			getAuthorContext: async () => {
				try {
					const config = useRemoteVaultStore.getState().syncConfig
					const auth = useAuthStore.getState()
					const deviceInfo = await deviceInfoLoad
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
						})),
						currentDeviceId: deviceInfo.deviceId,
						devices: devices.map((device) => ({
							id: device.id,
							label: device.deviceName,
							current: device.isCurrent ?? device.id === deviceInfo.deviceId,
						})),
					}
				} catch {
					const deviceInfo = await deviceInfoLoad
					return {
						authenticated: false,
						remoteVaultId: null,
						currentUserId: null,
						members: [],
						currentDeviceId: deviceInfo.deviceId,
						devices: [
							{
								id: deviceInfo.deviceId,
								label: deviceInfo.deviceName,
								current: true,
							},
						],
					}
				}
			},
		},
		metadata: {
			getNoteSourceMetadata: async (filePath) => {
				const entry = noteCache.getEntry(filePath)
				const fileMetadata = entry?.metadata ?? (await platform.fs.getFileMetadata(filePath))
				const vaultPath = useVaultStore.getState().vault?.path
				const config = useRemoteVaultStore.getState().syncConfig
				if (vaultPath && config.enabled && config.remoteVaultId) {
					const relativePath = filePath.replace(`${vaultPath}/`, "")
					const cacheKey = `${config.remoteVaultId}:${relativePath}`
					let load = noteMetadataLoads.get(cacheKey)
					if (!load) {
						load = loadRemoteNoteMetadata(vaultPath, relativePath).finally(() =>
							noteMetadataLoads.delete(cacheKey),
						)
						noteMetadataLoads.set(cacheKey, load)
					}
					const remote = await load.catch(() => null)
					if (remote) {
						const remoteUpdatedAt = Math.max(
							getMetadataTimestamp(remote.lastEditedAt),
							getMetadataTimestamp(remote.createdAt),
						)
						const localCreatedAt = entry?.localCreatedAt ?? 0
						if (localCreatedAt > 0 && remoteUpdatedAt < localCreatedAt) {
							const deviceInfo = await deviceInfoLoad
							return {
								source: "local" as const,
								synced: false,
								dirty: entry?.dirty ?? false,
								createdAt: new Date(fileMetadata.createdAt).toISOString(),
								createdBy: `device:${deviceInfo.deviceId}`,
								lastEditedAt: new Date(fileMetadata.modifiedAt).toISOString(),
								lastEditedBy: `device:${deviceInfo.deviceId}`,
							}
						}
						return {
							source: "remote" as const,
							synced: remote.synced,
							dirty: entry?.dirty ?? false,
							createdAt: remote.createdAt,
							createdBy: remote.createdBy,
							lastEditedAt: remote.lastEditedAt,
							lastEditedBy:
								remote.lastEditedBy ??
								(remote.lastDeviceId ? `device:${remote.lastDeviceId}` : null),
						}
					}
				}
				const deviceInfo = await deviceInfoLoad
				return {
					source: "local",
					synced: false,
					dirty: entry?.dirty ?? false,
					createdAt: new Date(fileMetadata.createdAt).toISOString(),
					createdBy: `device:${deviceInfo.deviceId}`,
					lastEditedAt: new Date(fileMetadata.modifiedAt).toISOString(),
					lastEditedBy: `device:${deviceInfo.deviceId}`,
				}
			},
		},
	})
}
