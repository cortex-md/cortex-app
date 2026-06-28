import { noteCache, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { initializeProperties } from "@cortex/properties"

let deviceInfoLoad:
	| Promise<{ deviceId: string; deviceName: string; deviceType: string }>
	| undefined
let initialized = false

function getDeviceInfoLoad(): Promise<{
	deviceId: string
	deviceName: string
	deviceType: string
}> {
	if (!deviceInfoLoad) {
		throw new Error("Mobile properties runtime was not initialized")
	}

	return deviceInfoLoad
}

export function initializeMobileProperties(): void {
	if (initialized) return
	initialized = true

	const platform = getPlatform()
	deviceInfoLoad = platform.device.getDeviceInfo().catch(async () => ({
		deviceId: await platform.device.getDeviceId(),
		deviceName: "This device",
		deviceType: "mobile",
	}))

	initializeProperties({
		createId: () => crypto.randomUUID(),
		files: {
			atomicWriteFile: (path, content) => platform.fs.atomicWriteFile(path, content),
			readFile: (path) => platform.fs.readFile(path),
		},
		identity: {
			getAuthorContext: async () => {
				const deviceInfo = await getDeviceInfoLoad()
				return {
					authenticated: false,
					currentDeviceId: deviceInfo.deviceId,
					currentUserId: null,
					devices: [
						{
							current: true,
							id: deviceInfo.deviceId,
							label: deviceInfo.deviceName,
						},
					],
					members: [],
					remoteVaultId: null,
				}
			},
		},
		metadata: {
			getNoteSourceMetadata: async (filePath) => {
				const entry = noteCache.getEntry(filePath)
				const fileMetadata = entry?.metadata ?? (await platform.fs.getFileMetadata(filePath))
				const deviceInfo = await getDeviceInfoLoad()

				return {
					createdAt: new Date(fileMetadata.createdAt).toISOString(),
					createdBy: `device:${deviceInfo.deviceId}`,
					dirty: entry?.dirty ?? false,
					lastEditedAt: new Date(fileMetadata.modifiedAt).toISOString(),
					lastEditedBy: `device:${deviceInfo.deviceId}`,
					source: "local",
					synced: false,
				}
			},
		},
		notes: {
			listMarkdownFiles: async () => {
				return useVaultStore
					.getState()
					.files.flatMap((file) =>
						!file.isDir && file.path.toLocaleLowerCase().endsWith(".md") ? [file.path] : [],
					)
			},
			readNote: (path) => {
				const entry = noteCache.getEntry(path)
				return entry ? Promise.resolve(entry.content) : platform.fs.readFile(path)
			},
			resolveVaultPath: (filePath) => {
				const vaultPath = useVaultStore.getState().vault?.path
				return vaultPath && filePath.startsWith(`${vaultPath}/`) ? vaultPath : null
			},
			writeNote: async (path, content) => {
				if (noteCache.getEntry(path)) {
					noteCache.writeExternal(path, content)
					return
				}

				await platform.fs.writeFile(path, content)
			},
		},
	})
}
