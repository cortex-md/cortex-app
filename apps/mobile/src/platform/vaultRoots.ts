import type { NativePlatform } from "@cortex/platform"
import { getBaseName, joinPath, VAULT_CONFIG_DIR } from "@cortex/platform/utils"
import { readOrCreateVaultFile, sanitizeVaultFolderName } from "@cortex/platform/vault"
import { Directory, File, Paths } from "expo-file-system"
import { CortexNative } from "../../modules/cortex-native"
import {
	appDirectoryName,
	getVaultRootMapPath,
	normalizeUri,
	readAppStorageJson,
	writeAppStorageJson,
} from "./appStorage"
import {
	isNotFoundError,
	isReauthorizationRequiredError,
	MobilePathNotFoundError,
	MobileReauthorizationRequiredError,
} from "./errors"
import { createMobileVaultLogicalPath, getMobileVaultPathParts } from "./mobile-vault-paths"
import { getNativePlatform } from "./nativePlatform"

export type MobileVaultRootLocation = "internal" | "external"

export type MobileVaultAccess = "available" | "needsAccess" | "missing"

export interface MobileVaultRootRecord {
	uuid: string
	logicalPath: string
	directoryUri: string
	displayPath: string
	lastAuthorizedAt: number
	platform: NativePlatform
	location?: MobileVaultRootLocation
	documentPath?: string
	bookmark?: string
}

const internalVaultsDirectoryName = "Vaults"

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

function canonicalUri(uri: string): string {
	return normalizeUri(uri).replace(/^file:\/\/\/private\/var\//u, "file:///var/")
}

function getDocumentRootUri(): string {
	return canonicalUri(Paths.document.uri)
}

function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment)
	} catch {
		return segment
	}
}

function toDocumentPath(directoryUri: string): string | null {
	const documentRoot = getDocumentRootUri()
	const normalizedUri = canonicalUri(directoryUri)
	if (!normalizedUri.startsWith(`${documentRoot}/`)) return null
	return normalizedUri
		.slice(documentRoot.length + 1)
		.split("/")
		.map(decodeSegment)
		.join("/")
}

function resolveDocumentDirectory(documentPath: string): Directory {
	return new Directory(Paths.document, ...documentPath.split("/").filter(Boolean))
}

function isInternalRoot(record: MobileVaultRootRecord): boolean {
	return record.location === "internal" && typeof record.documentPath === "string"
}

function persistAccess(directoryUri: string): string | undefined {
	if (!CortexNative) return undefined
	try {
		CortexNative.takePersistablePermission(directoryUri)
		return CortexNative.createBookmark(directoryUri) ?? undefined
	} catch {
		return undefined
	}
}

function restoreExternalAccess(record: MobileVaultRootRecord): MobileVaultRootRecord {
	if (!CortexNative || !record.bookmark) return record
	try {
		const resolved = CortexNative.resolveBookmark(record.bookmark)
		if (!resolved) return record
		const directoryUri = normalizeUri(resolved.uri)
		return {
			...record,
			directoryUri,
			bookmark: resolved.stale ? (persistAccess(directoryUri) ?? record.bookmark) : record.bookmark,
		}
	} catch {
		return record
	}
}

function hydrateRoot(record: MobileVaultRootRecord): MobileVaultRootRecord {
	if (!isInternalRoot(record)) return restoreExternalAccess({ ...record, location: "external" })
	return {
		...record,
		directoryUri: normalizeUri(resolveDocumentDirectory(record.documentPath ?? "").uri),
	}
}

export function getDirectoryName(directoryUri: string): string {
	return decodeSegment(new Directory(directoryUri).name)
}

export function getRootFolderName(record: MobileVaultRootRecord): string {
	if (isInternalRoot(record)) {
		return getBaseName(record.documentPath ?? "") || "Vault"
	}
	return getDirectoryName(record.directoryUri) || "Vault"
}

function toReauthorizationError(
	record: MobileVaultRootRecord,
	cause: unknown,
): MobileReauthorizationRequiredError {
	return new MobileReauthorizationRequiredError(record.logicalPath, getRootFolderName(record), {
		cause,
	})
}

export function listDirectoryEntries(
	directory: Directory,
	record?: MobileVaultRootRecord,
): (Directory | File)[] {
	try {
		return directory.list()
	} catch (error) {
		if (record && !isInternalRoot(record)) throw toReauthorizationError(record, error)
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

export async function readMobileVaultRoots(): Promise<MobileVaultRootRecord[]> {
	if (mobileVaultRootsCache) return mobileVaultRootsCache

	const roots = await readAppStorageJson<MobileVaultRootRecord[]>(getVaultRootMapPath())
	mobileVaultRootsCache = Array.isArray(roots)
		? roots
				.filter((root) => root.uuid && root.logicalPath && (root.directoryUri || root.documentPath))
				.map(hydrateRoot)
		: []

	for (const root of mobileVaultRootsCache) {
		logicalPathToActualUri.set(root.logicalPath, root.directoryUri)
	}

	return mobileVaultRootsCache
}

function serializeRoot(record: MobileVaultRootRecord): MobileVaultRootRecord {
	if (!isInternalRoot(record)) return record
	return { ...record, directoryUri: "" }
}

async function writeMobileVaultRoots(roots: MobileVaultRootRecord[]): Promise<void> {
	mobileVaultRootsCache = roots
	logicalPathToActualUri.clear()
	for (const root of roots) {
		logicalPathToActualUri.set(root.logicalPath, root.directoryUri)
	}
	await writeAppStorageJson(getVaultRootMapPath(), roots.map(serializeRoot))
}

export async function findMobileVaultRootByPath(path: string): Promise<MobileVaultRootRecord> {
	const parts = getMobileVaultPathParts(path)
	if (!parts) {
		throw new Error(`${path} is not a Cortex Mobile vault path`)
	}

	const roots = await readMobileVaultRoots()
	const root = roots.find((record) => record.uuid === parts.rootId)
	if (!root) {
		throw new Error("This vault is no longer available on this device.")
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

async function readDirectoryVaultId(
	directory: Directory,
	record: MobileVaultRootRecord,
): Promise<string> {
	const findConfigDirectory = () => findDirectory(directory, VAULT_CONFIG_DIR, record)
	const findConfigFile = (path: string) => {
		const configDirectory = findConfigDirectory()
		return configDirectory ? findFile(configDirectory, getBaseName(path), record) : null
	}
	const file = await readOrCreateVaultFile("", {
		createId: () => crypto.randomUUID(),
		isNotFound: isNotFoundError,
		readText: async (path) => {
			const configFile = findConfigFile(path)
			if (!configFile) throw new MobilePathNotFoundError(`Missing ${path}`)
			return configFile.text()
		},
		writeText: async (path, text) => {
			const configDirectory = findConfigDirectory() ?? directory.createDirectory(VAULT_CONFIG_DIR)
			const existing = findFile(configDirectory, getBaseName(path), record)
			const target = existing ?? configDirectory.createFile(getBaseName(path), "application/json")
			target.write(text)
		},
	})
	return file.id
}

async function saveRoot(
	directory: Directory,
	location: MobileVaultRootLocation,
	documentPath: string | null,
): Promise<string> {
	const directoryUri = normalizeUri(directory.uri)
	const rootPlatform = getNativePlatform()
	const base: MobileVaultRootRecord = {
		directoryUri,
		displayPath: decodeSegment(directory.name) || "Vault",
		lastAuthorizedAt: Date.now(),
		location,
		logicalPath: createMobileVaultLogicalPath("pending"),
		platform: rootPlatform,
		uuid: "pending",
		...(documentPath === null ? {} : { documentPath }),
	}
	if (location === "external") {
		const bookmark = persistAccess(directoryUri)
		if (bookmark) base.bookmark = bookmark
	}
	if (documentPath !== null) base.displayPath = getBaseName(documentPath) || "Vault"

	let uuid: string
	try {
		uuid = await readDirectoryVaultId(directory, base)
	} catch (error) {
		if (isReauthorizationRequiredError(error)) {
			throw new Error(`Cortex could not read “${base.displayPath}”.`, { cause: error })
		}
		throw error
	}

	const roots = await readMobileVaultRoots()
	const logicalPath = createMobileVaultLogicalPath(uuid)
	const nextRecord: MobileVaultRootRecord = { ...base, logicalPath, uuid }
	await writeMobileVaultRoots([
		...roots.filter(
			(root) => root.uuid !== uuid && normalizeUri(root.directoryUri) !== directoryUri,
		),
		nextRecord,
	])

	return logicalPath
}

export async function registerPickedDirectory(directory: Directory): Promise<string> {
	const directoryUri = normalizeUri(directory.uri)
	const documentPath = toDocumentPath(directoryUri)
	const roots = await readMobileVaultRoots()
	const existingRoot = roots.find((root) => normalizeUri(root.directoryUri) === directoryUri)

	if (existingRoot) {
		existingRoot.lastAuthorizedAt = Date.now()
		existingRoot.platform = getNativePlatform()
		if (!isInternalRoot(existingRoot)) {
			existingRoot.bookmark = persistAccess(directoryUri) ?? existingRoot.bookmark
		}
		await writeMobileVaultRoots(roots)
		return existingRoot.logicalPath
	}

	return saveRoot(directory, documentPath === null ? "external" : "internal", documentPath)
}

function findFreeInternalFolder(parent: Directory, name: string): Directory {
	const base = sanitizeVaultFolderName(name)
	for (let attempt = 1; ; attempt += 1) {
		const candidate = new Directory(parent, attempt === 1 ? base : `${base} ${attempt}`)
		if (!Paths.info(candidate.uri).exists) return candidate
	}
}

export async function createInternalVaultRoot(name: string): Promise<string> {
	const parent = new Directory(Paths.document, appDirectoryName, internalVaultsDirectoryName)
	parent.create({ idempotent: true, intermediates: true })
	const folder = findFreeInternalFolder(parent, name)
	folder.create()
	const documentPath = toDocumentPath(folder.uri)
	if (documentPath === null) throw new Error("The vault folder could not be created.")
	return saveRoot(folder, "internal", documentPath)
}

export function getLegacyDocumentPath(uri: string): string | null {
	const current = toDocumentPath(uri)
	if (current !== null) return current
	const normalizedUri = normalizeUri(uri)
	const marker = `/${appDirectoryName}/`
	const index = normalizedUri.indexOf(marker)
	if (index < 0) return null
	return normalizedUri
		.slice(index + 1)
		.split("/")
		.map(decodeSegment)
		.join("/")
}

export async function adoptLegacyDocumentPath(documentPath: string): Promise<string | null> {
	const directory = resolveDocumentDirectory(documentPath)
	if (!directory.exists) return null
	return saveRoot(directory, "internal", documentPath)
}

export async function findMobileVaultRoot(path: string): Promise<MobileVaultRootRecord | null> {
	return findMobileVaultRootByPath(path).catch(() => null)
}

export async function getMobileVaultFolderName(path: string): Promise<string | null> {
	const root = await findMobileVaultRoot(path)
	return root ? getRootFolderName(root) : null
}

export async function getMobileVaultAccess(path: string): Promise<MobileVaultAccess> {
	const root = await findMobileVaultRoot(path)
	if (!root) return getMobileVaultPathParts(path) ? "missing" : "available"
	const directory = new Directory(root.directoryUri)
	if (isInternalRoot(root)) return directory.exists ? "available" : "missing"
	try {
		directory.list()
		return "available"
	} catch {
		return "needsAccess"
	}
}

export async function reauthorizeMobileVault(path: string): Promise<boolean> {
	const root = await findMobileVaultRootByPath(path)
	let directory: Directory
	try {
		directory = await Directory.pickDirectoryAsync(root.directoryUri)
	} catch (error) {
		if (error instanceof Error && /cancel|dismiss|abort/iu.test(error.message)) return false
		throw error
	}
	const logicalPath = await registerPickedDirectory(directory)
	if (logicalPath !== root.logicalPath) {
		throw new Error(
			`That folder is not “${getRootFolderName(root)}”. Choose the same folder again.`,
		)
	}
	return true
}
