import type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	FileEntry,
	FileMetadata,
	NativeAppearanceSnapshot,
	NativePlatform,
	Platform as CortexPlatform,
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

import {
	createMobileVaultLogicalPath,
	getMobileVaultPathParts,
	getMobileVaultRelativePath,
	isHiddenMobileVaultPath,
	isMobileVaultLogicalPath,
	joinMobileVaultPath,
	normalizeMobileVaultPath,
} from "./mobile-vault-paths"

type UnsupportedPromise<T> = Promise<T>

interface VaultIdentityFile {
	uuid: string
}

interface MobileVaultMetadataFile {
	version: number
	name: string
	createdAt: string
}

export interface MobileVaultRootRecord {
	uuid: string
	logicalPath: string
	directoryUri: string
	displayPath: string
	lastAuthorizedAt: number
	platform: NativePlatform
}

interface ResolvedDirectory {
	directory: Directory
	logicalPath: string | null
}

interface ResolvedFile {
	file: File
	logicalPath: string | null
}

type ResolvedEntry =
	| {
			entry: Directory
			isDir: true
			logicalPath: string | null
	  }
	| {
			entry: File
			isDir: false
			logicalPath: string | null
	  }

const appDirectoryName = "Cortex"
const vaultRegistryFileName = "vaults.json"
const vaultRootMapFileName = "mobile-vault-roots.json"
const vaultIdentityFileName = "vault-id.json"
const vaultMetadataFileName = "vault-metadata.json"
const vaultConfigDirectoryName = ".cortex"
const markdownMimeType = "text/markdown"

const unsupportedNotificationResult = {
	delivered: false,
	reason: "unsupported",
} as const

let mobileVaultRootsCache: MobileVaultRootRecord[] | null = null
const logicalPathToActualUri = new Map<string, string>()

function unsupportedPhase1<T>(method: string): UnsupportedPromise<T> {
	return Promise.reject(new Error(`${method} is not available in Cortex Mobile yet`))
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

function ensureDirectory(directory: Directory): string {
	directory.create({ idempotent: true, intermediates: true })
	return normalizeUri(directory.uri)
}

function ensureAppDirectory(): string {
	return ensureDirectory(getAppDirectory())
}

function ensureParentDirectory(path: string): void {
	const normalizedPath = normalizeUri(path)
	const parentPath = normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
	if (!parentPath) return
	new Directory(parentPath).create({ idempotent: true, intermediates: true })
}

function getVaultRegistryPath(): string {
	return joinUri(ensureAppDirectory(), vaultRegistryFileName)
}

function getVaultRootMapPath(): string {
	return joinUri(ensureAppDirectory(), vaultRootMapFileName)
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

function isAppStoragePath(path: string): boolean {
	const normalizedPath = normalizeUri(path)
	const appDirectory = getAppDirectoryUri()
	return normalizedPath === appDirectory || normalizedPath.startsWith(`${appDirectory}/`)
}

function assertInsideAppData(path: string, operation: string): string {
	const normalizedPath = normalizeUri(path)
	if (isAppStoragePath(normalizedPath)) return normalizedPath
	throw new Error(`${operation} is limited to Cortex Mobile app storage or registered vault roots`)
}

function assertSupportedPath(path: string, operation: string): string {
	const normalizedUri = normalizeUri(path)
	if (isAppStoragePath(normalizedUri)) return normalizedUri

	const normalizedLogicalPath = normalizeMobileVaultPath(normalizedUri)
	if (isMobileVaultLogicalPath(normalizedLogicalPath)) {
		return normalizedLogicalPath
	}

	throw new Error(`${operation} is limited to Cortex Mobile app storage or registered vault roots`)
}

function getParentPath(path: string): string {
	const normalizedPath = normalizeMobileVaultPath(path)
	const index = normalizedPath.lastIndexOf("/")
	return index <= 0 ? "/" : normalizedPath.slice(0, index)
}

function getFileName(path: string): string {
	return normalizeMobileVaultPath(path).split("/").pop() ?? path
}

function formatDirectoryDisplayPath(uri: string, name: string): string {
	if (uri.startsWith("file://")) {
		return decodeURIComponent(uri.replace(/^file:\/\//u, ""))
	}

	if (uri.startsWith("content://")) {
		return name ? `${name} (${decodeURIComponent(uri)})` : decodeURIComponent(uri)
	}

	return uri
}

function isPickerCancelled(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return /cancel|dismiss|abort/iu.test(error.message)
}

function getReauthorizationMessage(record: MobileVaultRootRecord): string {
	if (record.platform === "ios") {
		return `Reauthorize vault "${record.displayPath}" by opening the folder again. iOS scoped folder access is session-based.`
	}

	return `Cortex no longer has access to "${record.displayPath}". Open the folder again to refresh access.`
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
	const actualUri = logicalPathToActualUri.get(normalizeMobileVaultPath(path))
	if (actualUri) return actualUri

	if (/^(asset|content|data|file|https?):/u.test(path)) {
		return path
	}

	return path.startsWith("/") && !isMobileVaultLogicalPath(path) ? `file://${path}` : path
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
		lastError: "Expo updates are not wired in Cortex Mobile yet",
		pendingUpdate: null,
		state: "unsupported" as const,
	}
}

function getActualPathInfo(path: string) {
	return Paths.info(path)
}

function isActualDirectoryPath(path: string): boolean {
	return getActualPathInfo(path).isDirectory === true
}

function getActualEntryMetadata(path: string): FileMetadata {
	const info = isActualDirectoryPath(path) ? new Directory(path).info() : new File(path).info()
	const modifiedAt = info.modificationTime ?? Date.now()
	return {
		createdAt: info.creationTime ?? modifiedAt,
		modifiedAt,
	}
}

function getEntryInfo(entry: File | Directory) {
	return entry instanceof Directory ? entry.info() : entry.info()
}

function normalizeFileEntry(entry: File | Directory, logicalPath: string): FileEntry {
	const info = getEntryInfo(entry)
	return {
		isDir: entry instanceof Directory,
		mtime: info.modificationTime ? Math.floor(info.modificationTime / 1000) : 0,
		name: entry.name,
		path: logicalPath,
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

async function readActualTextFile(path: string): Promise<string> {
	return new File(assertInsideAppData(path, "fs.readFile")).text()
}

async function writeActualTextFile(path: string, content: string): Promise<void> {
	const safePath = assertInsideAppData(path, "fs.writeFile")
	ensureParentDirectory(safePath)
	new File(safePath).write(content)
}

async function hashText(content: string): Promise<string> {
	return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, content)
}

async function hashActualFile(path: string): Promise<string> {
	const safePath = assertInsideAppData(path, "fs.hashFile")
	const digest = await ExpoCrypto.digest(
		ExpoCrypto.CryptoDigestAlgorithm.SHA256,
		await new File(safePath).bytes(),
	)
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function atomicWriteActualFile(path: string, content: string): Promise<void> {
	const safePath = assertInsideAppData(path, "fs.atomicWriteFile")
	const temporaryPath = `${safePath}.tmp-${ExpoCrypto.randomUUID()}`
	ensureParentDirectory(safePath)
	const temporaryFile = new File(temporaryPath)
	temporaryFile.write(content)
	await temporaryFile.move(new File(safePath), { overwrite: true })
}

async function readJsonFile<T>(path: string): Promise<T | null> {
	try {
		const text = isMobileVaultLogicalPath(path)
			? await readLogicalTextFile(path)
			: await readActualTextFile(path)
		return JSON.parse(text) as T
	} catch {
		return null
	}
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
	if (isMobileVaultLogicalPath(path)) {
		await writeLogicalTextFile(path, JSON.stringify(value, null, 2))
		return
	}

	await atomicWriteActualFile(path, JSON.stringify(value, null, 2))
}

async function readMobileVaultRoots(): Promise<MobileVaultRootRecord[]> {
	if (mobileVaultRootsCache) return mobileVaultRootsCache

	const roots = await readJsonFile<MobileVaultRootRecord[]>(getVaultRootMapPath())
	mobileVaultRootsCache = Array.isArray(roots)
		? roots.filter((root) => root.uuid && root.logicalPath && root.directoryUri)
		: []

	for (const root of mobileVaultRootsCache) {
		logicalPathToActualUri.set(root.logicalPath, root.directoryUri)
	}

	return mobileVaultRootsCache
}

async function writeMobileVaultRoots(roots: MobileVaultRootRecord[]): Promise<void> {
	mobileVaultRootsCache = roots
	logicalPathToActualUri.clear()
	for (const root of roots) {
		logicalPathToActualUri.set(root.logicalPath, root.directoryUri)
	}
	await atomicWriteActualFile(getVaultRootMapPath(), JSON.stringify(roots, null, 2))
}

async function findMobileVaultRootByPath(path: string): Promise<MobileVaultRootRecord> {
	const parts = getMobileVaultPathParts(path)
	if (!parts) {
		throw new Error(`${path} is not a Cortex Mobile vault path`)
	}

	const roots = await readMobileVaultRoots()
	const root = roots.find((record) => record.uuid === parts.rootId)
	if (!root) {
		throw new Error(`Vault root is not registered on this device: ${parts.rootId}`)
	}

	return root
}

function listDirectoryEntries(directory: Directory, record?: MobileVaultRootRecord): (Directory | File)[] {
	try {
		return directory.list()
	} catch (error) {
		if (record) {
			throw new Error(getReauthorizationMessage(record), { cause: error })
		}
		throw error
	}
}

function findEntry(directory: Directory, name: string, record?: MobileVaultRootRecord): File | Directory | null {
	return listDirectoryEntries(directory, record).find((entry) => entry.name === name) ?? null
}

function findDirectory(
	directory: Directory,
	name: string,
	record?: MobileVaultRootRecord,
): Directory | null {
	const entry = findEntry(directory, name, record)
	return entry instanceof Directory ? entry : null
}

function findFile(directory: Directory, name: string, record?: MobileVaultRootRecord): File | null {
	const entry = findEntry(directory, name, record)
	return entry instanceof File ? entry : null
}

async function resolveLogicalDirectory(
	path: string,
	options?: { create?: boolean },
): Promise<ResolvedDirectory> {
	const normalizedPath = normalizeMobileVaultPath(path)
	const root = await findMobileVaultRootByPath(normalizedPath)
	const rootDirectory = new Directory(root.directoryUri)
	const relativePath = getMobileVaultRelativePath(normalizedPath, root.logicalPath)

	if (!relativePath) {
		logicalPathToActualUri.set(root.logicalPath, root.directoryUri)
		return {
			directory: rootDirectory,
			logicalPath: root.logicalPath,
		}
	}

	let currentDirectory = rootDirectory
	let currentLogicalPath = root.logicalPath
	for (const segment of relativePath.split("/")) {
		currentLogicalPath = joinMobileVaultPath(currentLogicalPath, segment)
		let nextDirectory = findDirectory(currentDirectory, segment, root)
		if (!nextDirectory) {
			if (!options?.create) {
				throw new Error(`Directory does not exist: ${normalizedPath}`)
			}
			nextDirectory = currentDirectory.createDirectory(segment)
		}
		logicalPathToActualUri.set(currentLogicalPath, nextDirectory.uri)
		currentDirectory = nextDirectory
	}

	return {
		directory: currentDirectory,
		logicalPath: normalizedPath,
	}
}

async function resolveLogicalFile(
	path: string,
	options?: { create?: boolean; mimeType?: string | null },
): Promise<ResolvedFile> {
	const normalizedPath = normalizeMobileVaultPath(path)
	const parentPath = getParentPath(normalizedPath)
	const fileName = getFileName(normalizedPath)
	const parent = await resolveLogicalDirectory(parentPath, { create: options?.create })
	let file = findFile(parent.directory, fileName, await findMobileVaultRootByPath(normalizedPath))

	if (!file) {
		if (!options?.create) {
			throw new Error(`File does not exist: ${normalizedPath}`)
		}
		file = parent.directory.createFile(fileName, options.mimeType ?? null)
	}

	logicalPathToActualUri.set(normalizedPath, file.uri)

	return {
		file,
		logicalPath: normalizedPath,
	}
}

async function resolveLogicalEntry(path: string): Promise<ResolvedEntry> {
	const normalizedPath = normalizeMobileVaultPath(path)
	const root = await findMobileVaultRootByPath(normalizedPath)
	if (normalizedPath === root.logicalPath) {
		return {
			entry: new Directory(root.directoryUri),
			isDir: true,
			logicalPath: root.logicalPath,
		}
	}

	const parent = await resolveLogicalDirectory(getParentPath(normalizedPath))
	const entry = findEntry(parent.directory, getFileName(normalizedPath), root)
	if (!entry) throw new Error(`Path does not exist: ${normalizedPath}`)

	logicalPathToActualUri.set(normalizedPath, entry.uri)

	if (entry instanceof Directory) {
		return {
			entry,
			isDir: true,
			logicalPath: normalizedPath,
		}
	}

	return {
		entry,
		isDir: false,
		logicalPath: normalizedPath,
	}
}

function getActualEntry(path: string): ResolvedEntry {
	const safePath = assertInsideAppData(path, "fs.resolve")
	const isDir = isActualDirectoryPath(safePath)
	if (isDir) {
		return {
			entry: new Directory(safePath),
			isDir: true,
			logicalPath: null,
		}
	}

	return {
		entry: new File(safePath),
		isDir: false,
		logicalPath: null,
	}
}

async function resolveEntry(path: string): Promise<ResolvedEntry> {
	const supportedPath = assertSupportedPath(path, "fs.resolve")
	if (isMobileVaultLogicalPath(supportedPath)) return resolveLogicalEntry(supportedPath)
	return getActualEntry(supportedPath)
}

async function readLogicalTextFile(path: string): Promise<string> {
	return (await resolveLogicalFile(path)).file.text()
}

async function writeLogicalTextFile(path: string, content: string): Promise<void> {
	const file = await resolveLogicalFile(path, {
		create: true,
		mimeType: path.toLowerCase().endsWith(".md") ? markdownMimeType : "text/plain",
	})
	file.file.write(content)
}

async function readTextFile(path: string): Promise<string> {
	const supportedPath = assertSupportedPath(path, "fs.readFile")
	if (isMobileVaultLogicalPath(supportedPath)) return readLogicalTextFile(supportedPath)
	return readActualTextFile(supportedPath)
}

async function writeTextFile(path: string, content: string): Promise<void> {
	const supportedPath = assertSupportedPath(path, "fs.writeFile")
	if (isMobileVaultLogicalPath(supportedPath)) {
		await writeLogicalTextFile(supportedPath, content)
		return
	}

	await writeActualTextFile(supportedPath, content)
}

async function hashFile(path: string): Promise<string> {
	const supportedPath = assertSupportedPath(path, "fs.hashFile")
	if (!isMobileVaultLogicalPath(supportedPath)) return hashActualFile(supportedPath)
	return hashText(await readLogicalTextFile(supportedPath))
}

async function readFileSnapshot(path: string) {
	const content = await readTextFile(path)
	const [hash, metadata] = await Promise.all([hashText(content), getFileMetadata(path)])

	return {
		content,
		hash,
		metadata,
	}
}

async function atomicWriteFile(path: string, content: string): Promise<void> {
	const supportedPath = assertSupportedPath(path, "fs.atomicWriteFile")
	if (isMobileVaultLogicalPath(supportedPath)) {
		await writeLogicalTextFile(supportedPath, content)
		return
	}

	await atomicWriteActualFile(supportedPath, content)
}

async function deleteFile(path: string): Promise<void> {
	const entry = await resolveEntry(path)
	if (entry.logicalPath) {
		logicalPathToActualUri.delete(entry.logicalPath)
	}

	entry.entry.delete()
}

function createDestinationEntry(parentDirectory: Directory, path: string, isDir: boolean): Directory | File {
	const name = getFileName(path)
	return isDir ? new Directory(parentDirectory, name) : new File(parentDirectory, name)
}

async function renameFile(oldPath: string, newPath: string): Promise<void> {
	const source = await resolveEntry(oldPath)
	const supportedOldPath = assertSupportedPath(oldPath, "fs.renameFile")
	const supportedNewPath = assertSupportedPath(newPath, "fs.renameFile")
	if (isMobileVaultLogicalPath(supportedOldPath) !== isMobileVaultLogicalPath(supportedNewPath)) {
		throw new Error("Cannot move files between mobile vault roots and app storage")
	}

	if (isMobileVaultLogicalPath(supportedNewPath)) {
		const destinationParent = await resolveLogicalDirectory(getParentPath(supportedNewPath), { create: true })
		const destinationEntry = findEntry(
			destinationParent.directory,
			getFileName(supportedNewPath),
			await findMobileVaultRootByPath(supportedNewPath),
		)
		if (destinationEntry && supportedOldPath !== supportedNewPath) {
			throw new Error("Destination already exists")
		}

		await source.entry.move(
			createDestinationEntry(destinationParent.directory, supportedNewPath, source.isDir),
			{ overwrite: false },
		)
		logicalPathToActualUri.delete(supportedOldPath)
		return
	}

	const safeOldPath = assertInsideAppData(supportedOldPath, "fs.renameFile")
	const safeNewPath = assertInsideAppData(supportedNewPath, "fs.renameFile")
	const sourceInfo = getActualPathInfo(safeOldPath)
	const destinationInfo = getActualPathInfo(safeNewPath)

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

async function createDir(path: string): Promise<void> {
	const supportedPath = assertSupportedPath(path, "fs.createDir")
	if (isMobileVaultLogicalPath(supportedPath)) {
		await resolveLogicalDirectory(supportedPath, { create: true })
		return
	}

	ensureDirectory(new Directory(assertInsideAppData(supportedPath, "fs.createDir")))
}

async function listDir(path: string): Promise<FileEntry[]> {
	const supportedPath = assertSupportedPath(path, "fs.listDir")

	if (isMobileVaultLogicalPath(supportedPath)) {
		const root = await findMobileVaultRootByPath(supportedPath)
		const directory = await resolveLogicalDirectory(supportedPath)
		const entries: FileEntry[] = []
		for (const entry of listDirectoryEntries(directory.directory, root)) {
			if (isHiddenEntry(entry)) continue
			const logicalPath = joinMobileVaultPath(directory.logicalPath ?? root.logicalPath, entry.name)
			entries.push(normalizeFileEntry(entry, logicalPath))
			logicalPathToActualUri.set(logicalPath, entry.uri)
		}

		return sortFileEntries(entries)
	}

	const safePath = assertInsideAppData(supportedPath, "fs.listDir")
	const entries: FileEntry[] = []
	for (const entry of new Directory(safePath).list()) {
		if (!isHiddenEntry(entry)) entries.push(normalizeFileEntry(entry, normalizeUri(entry.uri)))
	}

	return sortFileEntries(entries)
}

function scanDirectory(
	directory: Directory,
	logicalDirectoryPath: string,
	files: FileEntry[],
	record: MobileVaultRootRecord,
): void {
	for (const entry of listDirectoryEntries(directory, record)) {
		const logicalPath = joinMobileVaultPath(logicalDirectoryPath, entry.name)
		if (isHiddenEntry(entry) || isHiddenMobileVaultPath(logicalPath)) continue
		const fileEntry = normalizeFileEntry(entry, logicalPath)
		files.push(fileEntry)
		logicalPathToActualUri.set(logicalPath, entry.uri)
		if (fileEntry.isDir) {
			scanDirectory(entry as Directory, logicalPath, files, record)
		}
	}
}

function scanActualDirectory(directory: Directory, files: FileEntry[]): void {
	for (const entry of directory.list()) {
		if (isHiddenEntry(entry)) continue
		const fileEntry = normalizeFileEntry(entry, normalizeUri(entry.uri))
		files.push(fileEntry)
		if (fileEntry.isDir) {
			scanActualDirectory(new Directory(fileEntry.path), files)
		}
	}
}

async function scanVault(path: string): Promise<FileEntry[]> {
	const supportedPath = assertSupportedPath(path, "vault.scanVault")

	if (isMobileVaultLogicalPath(supportedPath)) {
		const root = await findMobileVaultRootByPath(supportedPath)
		const directory = await resolveLogicalDirectory(root.logicalPath)
		const files: FileEntry[] = []
		scanDirectory(directory.directory, root.logicalPath, files, root)
		return sortFileEntries(files)
	}

	const safePath = assertInsideAppData(supportedPath, "vault.scanVault")
	const files: FileEntry[] = []
	scanActualDirectory(new Directory(safePath), files)
	return sortFileEntries(files)
}

async function getFileMetadata(path: string): Promise<FileMetadata> {
	const supportedPath = assertSupportedPath(path, "fs.getFileMetadata")

	if (isMobileVaultLogicalPath(supportedPath)) {
		const entry = await resolveEntry(supportedPath)
		const info = getEntryInfo(entry.entry)
		const modifiedAt = info.modificationTime ?? Date.now()
		return {
			createdAt: info.creationTime ?? modifiedAt,
			modifiedAt,
		}
	}

	return getActualEntryMetadata(supportedPath)
}

function getVaultConfigPath(vaultPath: string): string {
	return joinMobileVaultPath(vaultPath, vaultConfigDirectoryName)
}

function getVaultIdentityPath(vaultPath: string): string {
	return joinMobileVaultPath(getVaultConfigPath(vaultPath), vaultIdentityFileName)
}

function getVaultMetadataPath(vaultPath: string): string {
	return joinMobileVaultPath(getVaultConfigPath(vaultPath), vaultMetadataFileName)
}

async function readOrCreateVaultUuid(vaultPath: string): Promise<string> {
	const identityPath = getVaultIdentityPath(vaultPath)
	const identity = await readJsonFile<VaultIdentityFile>(identityPath)
	if (identity?.uuid) return identity.uuid

	const uuid = ExpoCrypto.randomUUID()
	await writeJsonFile(identityPath, { uuid })
	return uuid
}

async function readVaultName(vaultPath: string, fallbackName: string): Promise<string> {
	const metadata = await readJsonFile<MobileVaultMetadataFile>(getVaultMetadataPath(vaultPath))
	if (metadata?.name?.trim()) return metadata.name.trim()
	return fallbackName || "Vault"
}

async function ensureLogicalVaultConfig(vaultPath: string): Promise<void> {
	await resolveLogicalDirectory(getVaultConfigPath(vaultPath), { create: true })
}

async function registerPickedDirectory(directory: Directory): Promise<string> {
	const directoryUri = normalizeUri(directory.uri)
	const directoryName = directory.name || "Vault"
	const displayPath = formatDirectoryDisplayPath(directoryUri, directoryName)
	const roots = await readMobileVaultRoots()
	const existingRoot = roots.find((root) => normalizeUri(root.directoryUri) === directoryUri)
	const rootPlatform = getNativePlatform()

	if (existingRoot) {
		existingRoot.displayPath = displayPath
		existingRoot.lastAuthorizedAt = Date.now()
		existingRoot.platform = rootPlatform
		await writeMobileVaultRoots(roots)
		return existingRoot.logicalPath
	}

	const temporaryRecord: MobileVaultRootRecord = {
		directoryUri,
		displayPath,
		lastAuthorizedAt: Date.now(),
		logicalPath: createMobileVaultLogicalPath("pending"),
		platform: rootPlatform,
		uuid: "pending",
	}
	let uuid: string
	try {
		const configDirectory = findDirectory(directory, vaultConfigDirectoryName, temporaryRecord)
			?? directory.createDirectory(vaultConfigDirectoryName)
		const identityFile = findFile(configDirectory, vaultIdentityFileName, temporaryRecord)
		if (identityFile) {
			const identity = JSON.parse(await identityFile.text()) as VaultIdentityFile
			uuid = identity.uuid || ExpoCrypto.randomUUID()
		} else {
			uuid = ExpoCrypto.randomUUID()
			configDirectory.createFile(vaultIdentityFileName, "application/json").write(
				JSON.stringify({ uuid }, null, 2),
			)
		}
	} catch (error) {
		throw new Error(getReauthorizationMessage(temporaryRecord), { cause: error })
	}

	const logicalPath = createMobileVaultLogicalPath(uuid)
	const nextRecord: MobileVaultRootRecord = {
		directoryUri,
		displayPath,
		lastAuthorizedAt: Date.now(),
		logicalPath,
		platform: rootPlatform,
		uuid,
	}

	await writeMobileVaultRoots([
		...roots.filter((root) => root.uuid !== uuid && normalizeUri(root.directoryUri) !== directoryUri),
		nextRecord,
	])

	return logicalPath
}

async function pickFolder(): Promise<string | null> {
	try {
		const directory = await Directory.pickDirectoryAsync()
		return registerPickedDirectory(directory)
	} catch (error) {
		if (isPickerCancelled(error)) return null
		throw error
	}
}

async function getVaultMetadata(path: string): Promise<VaultMetadata> {
	const supportedPath = assertSupportedPath(path, "vault.getVaultMetadata")

	if (isMobileVaultLogicalPath(supportedPath)) {
		const root = await findMobileVaultRootByPath(supportedPath)
		await ensureLogicalVaultConfig(root.logicalPath)
		const [uuid, name, files] = await Promise.all([
			readOrCreateVaultUuid(root.logicalPath),
			readVaultName(root.logicalPath, root.displayPath.split("/").pop() ?? "Vault"),
			scanVault(root.logicalPath),
		])

		return {
			displayPath: root.displayPath,
			fileCount: files.filter((file) => !file.isDir).length,
			name,
			path: root.logicalPath,
			uuid,
		}
	}

	const safePath = assertInsideAppData(supportedPath, "vault.getVaultMetadata")
	const info = getActualPathInfo(safePath)
	if (!info.exists || !info.isDirectory) {
		throw new Error(`Vault path does not exist or is not a directory: ${path}`)
	}

	ensureDirectory(new Directory(joinUri(safePath, vaultConfigDirectoryName)))
	const identityPath = joinUri(joinUri(safePath, vaultConfigDirectoryName), vaultIdentityFileName)
	const metadataPath = joinUri(joinUri(safePath, vaultConfigDirectoryName), vaultMetadataFileName)
	const identity = await readJsonFile<VaultIdentityFile>(identityPath)
	const uuid = identity?.uuid ?? ExpoCrypto.randomUUID()
	if (!identity?.uuid) await writeJsonFile(identityPath, { uuid })
	const metadata = await readJsonFile<MobileVaultMetadataFile>(metadataPath)
	const files = await scanVault(safePath)

	return {
		displayPath: safePath.replace(/^file:\/\//u, ""),
		fileCount: files.filter((file) => !file.isDir).length,
		name: metadata?.name?.trim() || new Directory(safePath).name || "Vault",
		path: safePath,
		uuid,
	}
}

async function openVault(path: string): Promise<VaultMetadata> {
	return getVaultMetadata(path)
}

async function readVaultRegistry(): Promise<VaultRegistryEntry[]> {
	const registry = await readJsonFile<VaultRegistryEntry[]>(getVaultRegistryPath())
	const entries = Array.isArray(registry) ? registry : []
	const roots = await readMobileVaultRoots()

	return entries.map((entry) => {
		const root = roots.find((record) => record.uuid === entry.uuid || record.logicalPath === entry.path)
		return {
			...entry,
			displayPath: entry.displayPath ?? root?.displayPath ?? null,
			path: root?.logicalPath ?? entry.path,
		}
	})
}

async function updateVaultRegistry(
	uuid: string,
	path: string,
	name: string,
	icon?: string | null,
	color?: string | null,
): Promise<void> {
	const supportedPath = assertSupportedPath(path, "vault.updateVaultRegistry")
	const entries = await readVaultRegistry()
	const roots = await readMobileVaultRoots()
	const root = roots.find((record) => record.uuid === uuid || record.logicalPath === supportedPath)
	const existing = entries.find((entry) => entry.uuid === uuid)
	const lastOpened = Date.now()
	const displayPath =
		root?.displayPath ??
		(isAppStoragePath(supportedPath) ? supportedPath.replace(/^file:\/\//u, "") : null)

	if (existing) {
		existing.displayPath = displayPath
		existing.path = root?.logicalPath ?? supportedPath
		existing.name = name
		existing.lastOpened = lastOpened
		if (icon !== undefined) existing.icon = icon
		if (color !== undefined) existing.color = color
	} else {
		entries.push({
			color: color ?? null,
			displayPath,
			icon: icon ?? null,
			lastOpened,
			name,
			path: root?.logicalPath ?? supportedPath,
			uuid,
		})
	}

	await writeJsonFile(getVaultRegistryPath(), entries)

	const logicalPath =
		root?.logicalPath ?? (isMobileVaultLogicalPath(supportedPath) ? supportedPath : null)
	if (logicalPath) {
		const metadataPath = getVaultMetadataPath(logicalPath)
		const existingMetadata = await readJsonFile<MobileVaultMetadataFile>(metadataPath)
		await writeJsonFile(metadataPath, {
			createdAt: existingMetadata?.createdAt ?? new Date(lastOpened).toISOString(),
			name,
			version: existingMetadata?.version ?? 1,
		})
	}
}

async function removeFromVaultRegistry(uuid: string): Promise<void> {
	const entries = await readVaultRegistry()
	await writeJsonFile(
		getVaultRegistryPath(),
		entries.filter((entry) => entry.uuid !== uuid),
	)
}

async function mapActualUriToLogicalPath(uri: string): Promise<string | null> {
	const normalizedUri = normalizeUri(uri)
	const roots = await readMobileVaultRoots()
	const root = roots.find(
		(record) =>
			normalizedUri === normalizeUri(record.directoryUri) ||
			normalizedUri.startsWith(`${normalizeUri(record.directoryUri)}/`),
	)
	if (!root) return null
	if (normalizedUri === normalizeUri(root.directoryUri)) return root.logicalPath

	return joinMobileVaultPath(
		root.logicalPath,
		decodeURIComponent(normalizedUri.slice(normalizeUri(root.directoryUri).length + 1)),
	)
}

async function toWatchEvent(event: ExpoFileSystemWatchEvent<File | Directory>): Promise<WatchEvent> {
	const actualUri = normalizeUri(event.target.uri)
	const logicalPath = await mapActualUriToLogicalPath(actualUri)
	return {
		kind: event.type,
		path: logicalPath ?? actualUri,
		watcherId: logicalPath ?? actualUri,
	}
}

async function startWatching(
	path: string,
	callback: (event: WatchEvent) => void,
	options?: { includeHidden?: boolean },
): Promise<() => void> {
	const entry = await resolveEntry(path)
	if (normalizeUri(entry.entry.uri).startsWith("content://")) {
		return noopUnsubscribe
	}

	let subscription: { remove: () => void }
	try {
		subscription = entry.entry.watch((event) => {
			void toWatchEvent(event)
				.then((normalizedEvent) => {
					if (!options?.includeHidden && isHiddenMobileVaultPath(normalizedEvent.path)) return
					callback(normalizedEvent)
				})
				.catch((error) => {
					console.error("[Cortex Mobile watcher event failed]", error)
				})
		})
	} catch (error) {
		console.warn("[Cortex Mobile watcher unsupported]", { error, path })
		return noopUnsubscribe
	}

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
		pickFolder,
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
		createDir,
		deleteFile,
		downloadAndExtract: () => unsupportedPhase1("fs.downloadAndExtract"),
		downloadFile: () => unsupportedPhase1("fs.downloadFile"),
		getFileMetadata,
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
		getVaultConfigDir: async (vaultPath) => {
			if (isMobileVaultLogicalPath(vaultPath)) {
				await ensureLogicalVaultConfig(vaultPath)
				return getVaultConfigPath(vaultPath)
			}

			return ensureDirectory(
				new Directory(joinUri(assertInsideAppData(vaultPath, "storage.getVaultConfigDir"), ".cortex")),
			)
		},
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
		updateSyncPreferences: async () => {},
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
