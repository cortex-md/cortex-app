import type { NativePlatform } from "@cortex/platform"
import { getBaseName, joinPath, VAULT_CONFIG_DIR, VAULT_FILES } from "@cortex/platform/utils"
import { readOrCreateVaultId } from "@cortex/platform/vault"
import { Directory, File } from "expo-file-system"

import {
	getVaultRootMapPath,
	normalizeUri,
	readAppStorageJson,
	writeAppStorageJson,
} from "./appStorage"
import { isNotFoundError, MobilePathNotFoundError } from "./errors"
import { createMobileVaultLogicalPath, getMobileVaultPathParts } from "./mobile-vault-paths"
import { getNativePlatform } from "./nativePlatform"

export interface MobileVaultRootRecord {
	uuid: string
	logicalPath: string
	directoryUri: string
	displayPath: string
	lastAuthorizedAt: number
	platform: NativePlatform
}

let mobileVaultRootsCache: MobileVaultRootRecord[] | null = null
const logicalPathToActualUri = new Map<string, string>()

export function getKnownActualUri(logicalPath: string): string | undefined {
	return logicalPathToActualUri.get(logicalPath)
}

export function rememberActualUri(logicalPath: string, actualUri: string): void {
	logicalPathToActualUri.set(logicalPath, actualUri)
}

export function forgetActualUri(logicalPath: string): void {
	logicalPathToActualUri.delete(logicalPath)
}

export function getReauthorizationMessage(record: MobileVaultRootRecord): string {
	if (record.platform === "ios") {
		return `Reauthorize vault "${record.displayPath}" by opening the folder again. iOS scoped folder access is session-based.`
	}

	return `Cortex no longer has access to "${record.displayPath}". Open the folder again to refresh access.`
}

export function listDirectoryEntries(
	directory: Directory,
	record?: MobileVaultRootRecord,
): (Directory | File)[] {
	try {
		return directory.list()
	} catch (error) {
		if (record) {
			throw new Error(getReauthorizationMessage(record), { cause: error })
		}
		throw error
	}
}

export function findEntry(
	directory: Directory,
	name: string,
	record?: MobileVaultRootRecord,
): File | Directory | null {
	return listDirectoryEntries(directory, record).find((entry) => entry.name === name) ?? null
}

export function findDirectory(
	directory: Directory,
	name: string,
	record?: MobileVaultRootRecord,
): Directory | null {
	const entry = findEntry(directory, name, record)
	return entry instanceof Directory ? entry : null
}

export function findFile(
	directory: Directory,
	name: string,
	record?: MobileVaultRootRecord,
): File | null {
	const entry = findEntry(directory, name, record)
	return entry instanceof File ? entry : null
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

export function getDirectoryName(directoryUri: string): string {
	const name = new Directory(directoryUri).name
	try {
		return decodeURIComponent(name)
	} catch {
		return name
	}
}

export async function readMobileVaultRoots(): Promise<MobileVaultRootRecord[]> {
	if (mobileVaultRootsCache) return mobileVaultRootsCache

	const roots = await readAppStorageJson<MobileVaultRootRecord[]>(getVaultRootMapPath())
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
	await writeAppStorageJson(getVaultRootMapPath(), roots)
}

export async function findMobileVaultRootByPath(path: string): Promise<MobileVaultRootRecord> {
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

export async function mapActualUriToLogicalPath(uri: string): Promise<string | null> {
	const normalizedUri = normalizeUri(uri)
	const roots = await readMobileVaultRoots()
	const root = roots.find(
		(record) =>
			normalizedUri === normalizeUri(record.directoryUri) ||
			normalizedUri.startsWith(`${normalizeUri(record.directoryUri)}/`),
	)
	if (!root) return null
	if (normalizedUri === normalizeUri(root.directoryUri)) return root.logicalPath

	return joinPath(
		root.logicalPath,
		decodeURIComponent(normalizedUri.slice(normalizeUri(root.directoryUri).length + 1)),
	)
}

export async function registerPickedDirectory(directory: Directory): Promise<string> {
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
	const identityFileName = getBaseName(VAULT_FILES.vaultId)
	const findConfigDirectory = () => findDirectory(directory, VAULT_CONFIG_DIR, temporaryRecord)
	let uuid: string
	try {
		uuid = await readOrCreateVaultId("", {
			createId: () => crypto.randomUUID(),
			isNotFound: isNotFoundError,
			readText: async () => {
				const configDirectory = findConfigDirectory()
				const identityFile =
					configDirectory && findFile(configDirectory, identityFileName, temporaryRecord)
				if (!identityFile) throw new MobilePathNotFoundError(`Missing ${VAULT_FILES.vaultId}`)
				return identityFile.text()
			},
			writeText: async (_path, text) => {
				const configDirectory = findConfigDirectory() ?? directory.createDirectory(VAULT_CONFIG_DIR)
				configDirectory.createFile(identityFileName, "application/json").write(text)
			},
		})
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
		...roots.filter(
			(root) => root.uuid !== uuid && normalizeUri(root.directoryUri) !== directoryUri,
		),
		nextRecord,
	])

	return logicalPath
}
