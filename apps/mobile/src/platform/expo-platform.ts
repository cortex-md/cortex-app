import type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	Platform as CortexPlatform,
	FileEntry,
	FileMetadata,
	NativeAppearanceSnapshot,
	NativePlatform,
	VaultMetadata,
	VaultRegistryEntry,
	WatchEvent,
} from "@cortex/platform"
import Constants from "expo-constants"
import * as ExpoCrypto from "expo-crypto"
import * as Device from "expo-device"
import {
	Directory,
	type WatchEvent as ExpoFileSystemWatchEvent,
	File,
	Paths,
} from "expo-file-system"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { AccessibilityInfo, Alert, Appearance, Platform as ReactNativePlatform } from "react-native"

type UnsupportedPromise<T> = Promise<T>

interface VaultIdentityFile {
	uuid: string
}

interface MobileVaultMetadataFile {
	version: number
	name: string
	createdAt: string
}

const appDirectoryName = "Cortex"
const vaultRegistryFileName = "vaults.json"
const vaultIdentityFileName = "vault-id.json"
const vaultMetadataFileName = "vault-metadata.json"

const unsupportedNotificationResult = {
	delivered: false,
	reason: "unsupported",
} as const

function unsupportedPhase1<T>(method: string): UnsupportedPromise<T> {
	return Promise.reject(new Error(`${method} is not available in Cortex Mobile Phase 1`))
}

function noopUnsubscribe() {}

function normalizeUri(uri: string): string {
	return uri.replace(/\/+$/u, "")
}

function joinUri(parent: string, child: string): string {
	return `${normalizeUri(parent)}/${child}`
}

function getAppDirectory(): Directory {
	return new Directory(Paths.document, appDirectoryName)
}

function getAppDirectoryUri(): string {
	return normalizeUri(getAppDirectory().uri)
}

function assertInsideAppData(path: string, operation: string): string {
	const normalizedPath = normalizeUri(path)
	const appDirectory = getAppDirectoryUri()
	if (normalizedPath === appDirectory || normalizedPath.startsWith(`${appDirectory}/`)) {
		return normalizedPath
	}

	throw new Error(`${operation} is limited to Cortex Mobile app storage`)
}

function ensureDirectory(directory: Directory): string {
	directory.create({ idempotent: true, intermediates: true })
	return normalizeUri(directory.uri)
}

function ensureAppDirectory(): string {
	return ensureDirectory(getAppDirectory())
}

function ensureParentDirectory(path: string): void {
	const parentPath = normalizeUri(path).slice(0, normalizeUri(path).lastIndexOf("/"))
	if (!parentPath) return
	new Directory(parentPath).create({ idempotent: true, intermediates: true })
}

function getVaultConfigPath(vaultPath: string): string {
	return joinUri(assertInsideAppData(vaultPath, "storage.getVaultConfigDir"), ".cortex")
}

function getVaultIdentityPath(vaultPath: string): string {
	return joinUri(getVaultConfigPath(vaultPath), vaultIdentityFileName)
}

function getVaultMetadataPath(vaultPath: string): string {
	return joinUri(getVaultConfigPath(vaultPath), vaultMetadataFileName)
}

function getVaultRegistryPath(): string {
	return joinUri(ensureAppDirectory(), vaultRegistryFileName)
}

function getNativePlatform(): NativePlatform {
	switch (ReactNativePlatform.OS) {
		case "ios":
			return "ios"
		case "android":
			return "android"
		case "web":
			return "web"
		case "macos":
			return "macos"
		case "windows":
			return "windows"
		default:
			return "linux"
	}
}

async function getAppearanceSnapshot(): Promise<NativeAppearanceSnapshot> {
	const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled()

	return {
		accentColor: null,
		colorScheme: Appearance.getColorScheme() === "dark" ? "dark" : "light",
		highContrast: false,
		platform: getNativePlatform(),
		reducedMotion,
		scrollbarStyle: "overlay",
	}
}

function getCurrentAppVersion(): Promise<string> {
	return Promise.resolve(Constants.expoConfig?.version ?? "0.0.0")
}

function resolveFileAssetUrl(path: string): string {
	if (/^(asset|content|data|file|https?):/u.test(path)) {
		return path
	}

	return path.startsWith("/") ? `file://${path}` : path
}

function normalizeConfirmOptions(
	titleOrOptions: string | ConfirmDialogOptions,
	message?: string,
): ConfirmDialogOptions {
	if (typeof titleOrOptions === "string") {
		return {
			message: message ?? "",
			title: titleOrOptions,
		}
	}

	return titleOrOptions
}

function normalizeAlertOptions(
	titleOrOptions: string | AlertDialogOptions,
	message?: string,
): AlertDialogOptions {
	if (typeof titleOrOptions === "string") {
		return {
			message: message ?? "",
			title: titleOrOptions,
		}
	}

	return titleOrOptions
}

function getDeviceTypeLabel(deviceType: Device.DeviceType | null): string {
	switch (deviceType) {
		case Device.DeviceType.PHONE:
			return "phone"
		case Device.DeviceType.TABLET:
			return "tablet"
		case Device.DeviceType.DESKTOP:
			return "desktop"
		case Device.DeviceType.TV:
			return "tv"
		default:
			return "unknown"
	}
}

async function getDeviceInfo() {
	const deviceType = await Device.getDeviceTypeAsync().catch(() => Device.deviceType)
	const deviceName =
		Device.deviceName ?? Device.modelName ?? Device.brand ?? `${ReactNativePlatform.OS} device`
	const buildId = Device.osBuildId ?? Constants.sessionId

	return {
		deviceId: `expo-${ReactNativePlatform.OS}-${buildId}`,
		deviceName,
		deviceType: getDeviceTypeLabel(deviceType),
	}
}

async function showConfirm(
	titleOrOptions: string | ConfirmDialogOptions,
	message?: string,
): Promise<boolean> {
	const options = normalizeConfirmOptions(titleOrOptions, message)

	return new Promise((resolve) => {
		Alert.alert(options.title, options.message, [
			{
				onPress: () => resolve(false),
				style: "cancel",
				text: options.cancelLabel ?? "Cancel",
			},
			{
				onPress: () => resolve(true),
				style: options.destructive ? "destructive" : "default",
				text: options.confirmLabel ?? "OK",
			},
		])
	})
}

async function showAlert(
	titleOrOptions: string | AlertDialogOptions,
	message?: string,
): Promise<void> {
	const options = normalizeAlertOptions(titleOrOptions, message)

	return new Promise((resolve) => {
		Alert.alert(options.title, options.message, [
			{
				onPress: () => resolve(),
				text: options.okLabel ?? "OK",
			},
		])
	})
}

async function getUnsupportedUpdateStatus() {
	return {
		contentLength: null,
		currentVersion: await getCurrentAppVersion(),
		downloaded: 0,
		lastCheckedAt: null,
		lastError: "Expo updates are not wired in Cortex Mobile Phase 1",
		pendingUpdate: null,
		state: "unsupported" as const,
	}
}

function getPathInfo(path: string) {
	return Paths.info(path)
}

function isDirectoryPath(path: string): boolean {
	return getPathInfo(path).isDirectory === true
}

function getEntryMetadata(path: string): FileMetadata {
	const info = isDirectoryPath(path) ? new Directory(path).info() : new File(path).info()
	const modifiedAt = info.modificationTime ?? Date.now()
	return {
		createdAt: info.creationTime ?? modifiedAt,
		modifiedAt,
	}
}

function normalizeFileEntry(entry: File | Directory): FileEntry {
	const path = normalizeUri(entry.uri)
	const isDir = entry instanceof Directory
	const info = isDir ? entry.info() : entry.info()

	return {
		isDir,
		mtime: info.modificationTime ? Math.floor(info.modificationTime / 1000) : 0,
		name: entry.name,
		path,
		size: info.size ?? 0,
	}
}

function sortFileEntries(entries: FileEntry[]): FileEntry[] {
	return entries.sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
		return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase())
	})
}

function isHiddenEntry(entry: File | Directory): boolean {
	return entry.name.startsWith(".")
}

function isHiddenPath(path: string): boolean {
	return normalizeUri(path)
		.split("/")
		.some((segment) => segment.startsWith("."))
}

function readTextFile(path: string): Promise<string> {
	return new File(assertInsideAppData(path, "fs.readFile")).text()
}

async function writeTextFile(path: string, content: string): Promise<void> {
	const safePath = assertInsideAppData(path, "fs.writeFile")
	ensureParentDirectory(safePath)
	new File(safePath).write(content)
}

async function hashText(content: string): Promise<string> {
	return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, content)
}

async function hashFile(path: string): Promise<string> {
	const safePath = assertInsideAppData(path, "fs.hashFile")
	const digest = await ExpoCrypto.digest(
		ExpoCrypto.CryptoDigestAlgorithm.SHA256,
		await new File(safePath).bytes(),
	)
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function readFileSnapshot(path: string) {
	const safePath = assertInsideAppData(path, "fs.readFileSnapshot")
	const content = await new File(safePath).text()
	const [hash, metadata] = await Promise.all([
		hashText(content),
		Promise.resolve(getEntryMetadata(safePath)),
	])

	return {
		content,
		hash,
		metadata,
	}
}

async function atomicWriteFile(path: string, content: string): Promise<void> {
	const safePath = assertInsideAppData(path, "fs.atomicWriteFile")
	const temporaryPath = `${safePath}.tmp-${ExpoCrypto.randomUUID()}`
	ensureParentDirectory(safePath)
	const temporaryFile = new File(temporaryPath)
	temporaryFile.write(content)
	await temporaryFile.move(new File(safePath), { overwrite: true })
}

async function deleteFile(path: string): Promise<void> {
	const safePath = assertInsideAppData(path, "fs.deleteFile")
	if (isDirectoryPath(safePath)) {
		new Directory(safePath).delete()
		return
	}

	new File(safePath).delete()
}

async function renameFile(oldPath: string, newPath: string): Promise<void> {
	const safeOldPath = assertInsideAppData(oldPath, "fs.renameFile")
	const safeNewPath = assertInsideAppData(newPath, "fs.renameFile")
	const sourceInfo = getPathInfo(safeOldPath)
	const destinationInfo = getPathInfo(safeNewPath)

	if (!sourceInfo.exists) {
		throw new Error(`Source path does not exist: ${oldPath}`)
	}
	if (destinationInfo.exists && safeOldPath !== safeNewPath) {
		throw new Error("Destination already exists")
	}

	ensureParentDirectory(safeNewPath)
	if (sourceInfo.isDirectory) {
		await new Directory(safeOldPath).move(new Directory(safeNewPath), { overwrite: false })
		return
	}

	await new File(safeOldPath).move(new File(safeNewPath), { overwrite: false })
}

async function listDir(path: string): Promise<FileEntry[]> {
	const safePath = assertInsideAppData(path, "fs.listDir")
	const entries: FileEntry[] = []
	for (const entry of new Directory(safePath).list()) {
		if (!isHiddenEntry(entry)) entries.push(normalizeFileEntry(entry))
	}

	return sortFileEntries(entries)
}

function scanDirectory(directory: Directory, files: FileEntry[]): void {
	for (const entry of directory.list()) {
		if (isHiddenEntry(entry)) continue
		const fileEntry = normalizeFileEntry(entry)
		files.push(fileEntry)
		if (fileEntry.isDir) {
			scanDirectory(new Directory(fileEntry.path), files)
		}
	}
}

async function scanVault(path: string): Promise<FileEntry[]> {
	const safePath = assertInsideAppData(path, "vault.scanVault")
	const files: FileEntry[] = []
	scanDirectory(new Directory(safePath), files)
	return sortFileEntries(files)
}

async function readJsonFile<T>(path: string): Promise<T | null> {
	try {
		return JSON.parse(await readTextFile(path)) as T
	} catch {
		return null
	}
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
	await atomicWriteFile(path, JSON.stringify(value, null, 2))
}

async function readOrCreateVaultUuid(vaultPath: string): Promise<string> {
	const identityPath = getVaultIdentityPath(vaultPath)
	const identity = await readJsonFile<VaultIdentityFile>(identityPath)
	if (identity?.uuid) return identity.uuid

	const uuid = ExpoCrypto.randomUUID()
	await writeJsonFile(identityPath, { uuid })
	return uuid
}

async function readVaultName(vaultPath: string): Promise<string> {
	const metadata = await readJsonFile<MobileVaultMetadataFile>(getVaultMetadataPath(vaultPath))
	if (metadata?.name?.trim()) return metadata.name.trim()
	return new Directory(vaultPath).name || "Vault"
}

async function getVaultMetadata(path: string): Promise<VaultMetadata> {
	const safePath = assertInsideAppData(path, "vault.getVaultMetadata")
	const info = getPathInfo(safePath)
	if (!info.exists || !info.isDirectory) {
		throw new Error(`Vault path does not exist or is not a directory: ${path}`)
	}

	ensureDirectory(new Directory(getVaultConfigPath(safePath)))
	const [uuid, name, files] = await Promise.all([
		readOrCreateVaultUuid(safePath),
		readVaultName(safePath),
		scanVault(safePath),
	])

	return {
		fileCount: files.filter((file) => !file.isDir).length,
		name,
		path: safePath,
		uuid,
	}
}

async function openVault(path: string): Promise<VaultMetadata> {
	return getVaultMetadata(path)
}

async function readVaultRegistry(): Promise<VaultRegistryEntry[]> {
	const registry = await readJsonFile<VaultRegistryEntry[]>(getVaultRegistryPath())
	return Array.isArray(registry) ? registry : []
}

async function updateVaultRegistry(
	uuid: string,
	path: string,
	name: string,
	icon?: string | null,
	color?: string | null,
): Promise<void> {
	const safePath = assertInsideAppData(path, "vault.updateVaultRegistry")
	const entries = await readVaultRegistry()
	const existing = entries.find((entry) => entry.uuid === uuid)
	const lastOpened = Date.now()

	if (existing) {
		existing.path = safePath
		existing.name = name
		existing.lastOpened = lastOpened
		if (icon !== undefined) existing.icon = icon
		if (color !== undefined) existing.color = color
	} else {
		entries.push({
			color: color ?? null,
			icon: icon ?? null,
			lastOpened,
			name,
			path: safePath,
			uuid,
		})
	}

	await writeJsonFile(getVaultRegistryPath(), entries)
}

async function removeFromVaultRegistry(uuid: string): Promise<void> {
	const entries = await readVaultRegistry()
	await writeJsonFile(
		getVaultRegistryPath(),
		entries.filter((entry) => entry.uuid !== uuid),
	)
}

function toWatchEvent(event: ExpoFileSystemWatchEvent<File | Directory>): WatchEvent {
	return {
		kind: event.type,
		path: normalizeUri(event.target.uri),
		watcherId: normalizeUri(event.target.uri),
	}
}

async function startWatching(
	path: string,
	callback: (event: WatchEvent) => void,
	options?: { includeHidden?: boolean },
): Promise<() => void> {
	const safePath = assertInsideAppData(path, "fs.startWatching")
	const target = isDirectoryPath(safePath) ? new Directory(safePath) : new File(safePath)
	const subscription = target.watch((event) => {
		const normalizedEvent = toWatchEvent(event)
		if (!options?.includeHidden && isHiddenPath(normalizedEvent.path)) return
		callback(normalizedEvent)
	})

	return () => subscription.remove()
}

export const expoPlatform: CortexPlatform = {
	app: {
		getCurrentAppVersion,
		onDeepLinkOpen: async (listener) => {
			const subscription = Linking.addEventListener("url", (event) => listener([event.url]))

			void Linking.getInitialURL().then((url) => {
				if (url) {
					listener([url])
				}
			})

			return () => subscription.remove()
		},
		openExternalUrl: async (url) => {
			if (await Linking.canOpenURL(url)) {
				await Linking.openURL(url)
				return
			}

			await WebBrowser.openBrowserAsync(url)
		},
		resolveFileAssetUrl,
	},
	appearance: {
		getSnapshot: getAppearanceSnapshot,
		subscribe: (listener) => {
			const subscription = Appearance.addChangeListener(() => {
				void getAppearanceSnapshot().then(listener)
			})

			return () => subscription.remove()
		},
	},
	appUpdates: {
		checkForUpdate: getUnsupportedUpdateStatus,
		fetchChangelog: async () => null,
		getStatus: getUnsupportedUpdateStatus,
		installUpdate: getUnsupportedUpdateStatus,
	},
	auth: {
		getCurrentUser: async () => null,
		getStatus: async () => ({
			authenticated: false,
			displayName: null,
			email: null,
			userId: null,
		}),
		login: () => unsupportedPhase1("auth.login"),
		logout: () => unsupportedPhase1("auth.logout"),
		register: () => unsupportedPhase1("auth.register"),
	},
	capabilities: [],
	device: {
		getDeviceId: async () => {
			const info = await getDeviceInfo()
			return info.deviceId
		},
		getDeviceInfo,
	},
	devices: {
		get: () => unsupportedPhase1("devices.get"),
		list: () => unsupportedPhase1("devices.list"),
		rename: () => unsupportedPhase1("devices.rename"),
		revoke: () => unsupportedPhase1("devices.revoke"),
		updateSyncCursor: () => unsupportedPhase1("devices.updateSyncCursor"),
	},
	dialog: {
		pickFile: () => unsupportedPhase1("dialog.pickFile"),
		pickFolder: () => unsupportedPhase1("dialog.pickFolder"),
		revealFolder: () => unsupportedPhase1("dialog.revealFolder"),
		saveFile: () => unsupportedPhase1("dialog.saveFile"),
		showAlert,
		showConfirm,
	},
	font: {
		listSystemFonts: async () => [],
	},
	fs: {
		atomicWriteFile,
		createDir: async (path) => {
			ensureDirectory(new Directory(assertInsideAppData(path, "fs.createDir")))
		},
		deleteFile,
		downloadAndExtract: () => unsupportedPhase1("fs.downloadAndExtract"),
		downloadFile: () => unsupportedPhase1("fs.downloadFile"),
		getFileMetadata: async (path) =>
			getEntryMetadata(assertInsideAppData(path, "fs.getFileMetadata")),
		hashFile,
		listDir,
		readFile: readTextFile,
		readFileSnapshot,
		renameFile,
		startWatching,
		writeBinaryFile: () => unsupportedPhase1("fs.writeBinaryFile"),
		writeFile: writeTextFile,
	},
	http: {
		download: async (url) => {
			const response = await fetch(url)

			if (!response.ok) {
				throw new Error(`HTTP ${response.status} while downloading ${url}`)
			}

			return response.text()
		},
		fetch: (url, options) => fetch(url, options),
	},
	keychain: {
		delete: () => unsupportedPhase1("keychain.delete"),
		get: () => unsupportedPhase1("keychain.get"),
		set: () => unsupportedPhase1("keychain.set"),
	},
	members: {
		acceptInvite: () => unsupportedPhase1("members.acceptInvite"),
		createInvite: () => unsupportedPhase1("members.createInvite"),
		deleteInvite: () => unsupportedPhase1("members.deleteInvite"),
		listInvites: () => unsupportedPhase1("members.listInvites"),
		listMembers: () => unsupportedPhase1("members.listMembers"),
		myInvites: () => unsupportedPhase1("members.myInvites"),
		removeMember: () => unsupportedPhase1("members.removeMember"),
		updateMemberRole: () => unsupportedPhase1("members.updateMemberRole"),
	},
	notifications: {
		getCapabilities: () => ({
			actions: false,
			icons: false,
			sounds: false,
			supported: false,
		}),
		getPermission: async () => "unsupported",
		requestPermission: async () => "unsupported",
		send: async () => unsupportedNotificationResult,
	},
	remoteVault: {
		create: () => unsupportedPhase1("remoteVault.create"),
		delete: () => unsupportedPhase1("remoteVault.delete"),
		get: () => unsupportedPhase1("remoteVault.get"),
		getLink: async () => null,
		link: () => unsupportedPhase1("remoteVault.link"),
		list: () => unsupportedPhase1("remoteVault.list"),
		readSyncConfig: async () => ({
			enabled: false,
			offlineMode: true,
			remoteVaultId: null,
			selfHosted: false,
			selfHostedEnvironment: {},
			serverUrl: null,
		}),
		unlink: () => unsupportedPhase1("remoteVault.unlink"),
		update: () => unsupportedPhase1("remoteVault.update"),
		updateSyncConfig: () => unsupportedPhase1("remoteVault.updateSyncConfig"),
	},
	storage: {
		getAppDataDir: async () => ensureAppDirectory(),
		getVaultConfigDir: async (vaultPath) =>
			ensureDirectory(new Directory(getVaultConfigPath(vaultPath))),
	},
	subscription: {
		getStatus: async () => ({
			billingCycle: null,
			currentPeriodEnd: null,
			currentPeriodStart: null,
			entitled: false,
			entitlementExpiresAt: null,
			planProductId: null,
			status: "unsupported",
		}),
	},
	sync: {
		checkVaultEncryption: () => unsupportedPhase1("sync.checkVaultEncryption"),
		createVaultKey: () => unsupportedPhase1("sync.createVaultKey"),
		downloadVersion: () => unsupportedPhase1("sync.downloadVersion"),
		forceSyncFile: () => unsupportedPhase1("sync.forceSyncFile"),
		getConflicts: () => unsupportedPhase1("sync.getConflicts"),
		getNoteMetadata: () => unsupportedPhase1("sync.getNoteMetadata"),
		getVersionHistory: () => unsupportedPhase1("sync.getVersionHistory"),
		listDeletedFiles: () => unsupportedPhase1("sync.listDeletedFiles"),
		onConflict: async () => noopUnsubscribe,
		onFileEvent: async () => noopUnsubscribe,
		onInitialSyncComplete: async () => noopUnsubscribe,
		onInitialSyncProgress: async () => noopUnsubscribe,
		onStateChanged: async () => noopUnsubscribe,
		onSyncLog: async () => noopUnsubscribe,
		onVaultAccessDenied: async () => noopUnsubscribe,
		onVekRequired: async () => noopUnsubscribe,
		resolveConflict: () => unsupportedPhase1("sync.resolveConflict"),
		restoreDeletedFile: () => unsupportedPhase1("sync.restoreDeletedFile"),
		restoreVersion: () => unsupportedPhase1("sync.restoreVersion"),
		start: () => unsupportedPhase1("sync.start"),
		stop: () => unsupportedPhase1("sync.stop"),
		unlockVaultKey: () => unsupportedPhase1("sync.unlockVaultKey"),
		updateSyncPreferences: () => unsupportedPhase1("sync.updateSyncPreferences"),
	},
	vault: {
		getVaultMetadata,
		openVault,
		readVaultRegistry,
		refreshMenuRecents: async () => {},
		removeFromVaultRegistry,
		scanVault,
		updateVaultRegistry,
	},
	window: {
		closeCurrent: () => unsupportedPhase1("window.closeCurrent"),
		focusMain: () => unsupportedPhase1("window.focusMain"),
		openSettings: () => unsupportedPhase1("window.openSettings"),
		restartApp: () => unsupportedPhase1("window.restartApp"),
	},
}
