import { hashBytes } from "./hash"
import type { FileEntry, FileMetadata, FileSnapshot } from "./interfaces/FileSystem"
import type { VaultRegistryEntry, VaultRegistryPatch } from "./interfaces/Vault"
import {
	compareFileEntryNames,
	getBaseName,
	getParentPath,
	getVaultFilePath,
	normalizePath,
	VAULT_CONFIG_DIR,
	VAULT_FILES,
} from "./utils"

export interface FileStatInput {
	path: string
	name: string
	isDir: boolean
	size: number
	mtimeMs: number
}

export interface FileTimesInput {
	mtimeMs: number
	birthtimeMs: number
}

export interface VaultTextIo {
	readText(path: string): Promise<string>
	writeText(path: string, text: string): Promise<void>
	isNotFound(error: unknown): boolean
	createId(): string
	now?(): number
}

export interface VaultRegistryInput {
	uuid: string
	path: string
	name: string
	icon?: string | null
	color?: string | null
	displayPath?: string | null
}

export interface VaultFile {
	version: number
	id: string
	name: string | null
	createdAt: string
}

export const VAULT_FILE_VERSION = 1

export interface DeviceIdStore {
	get(key: string): string | null
	set(key: string, value: string): void
}

export const DEVICE_ID_KEY = "device_id"

const SYSTEM_IGNORED_NAMES = new Set([
	".DS_Store",
	"Thumbs.db",
	"desktop.ini",
	".git",
	"node_modules",
])

const VISIBLE_HIDDEN_PREFIX = `${VAULT_CONFIG_DIR}/schema/`

const SECONDS_TIMESTAMP_LIMIT = 100_000_000_000

export function toFileEntry({ path, name, isDir, size, mtimeMs }: FileStatInput): FileEntry {
	return { path: normalizePath(path), name, isDir, size, mtime: Math.floor(mtimeMs / 1000) }
}

export function toFileMetadata({ mtimeMs, birthtimeMs }: FileTimesInput): FileMetadata {
	const modifiedAt = Math.floor(mtimeMs)
	return { createdAt: birthtimeMs > 0 ? Math.floor(birthtimeMs) : modifiedAt, modifiedAt }
}

export function compareFileEntries(left: FileEntry, right: FileEntry): number {
	return compareFileEntryNames(left, right)
}

export function snapshotFromContent(content: string, metadata: FileMetadata): FileSnapshot {
	return { content, hash: hashBytes(content), metadata }
}

export function isInternalVaultFile(relativePath: string): boolean {
	return (
		relativePath === VAULT_FILES.cache ||
		relativePath.startsWith(`${VAULT_FILES.cache}/`) ||
		relativePath.startsWith(VAULT_FILES.syncDb) ||
		relativePath.startsWith(`${VAULT_FILES.history}/`)
	)
}

export function isHiddenVaultPath(
	relativePath: string,
	options: { includeHidden?: boolean } = {},
): boolean {
	const path = normalizePath(relativePath).replace(/^\/+/u, "")
	const segments = path.split("/")
	if (segments.some((segment) => SYSTEM_IGNORED_NAMES.has(segment))) return true
	if (isInternalVaultFile(path)) return true
	if (options.includeHidden || path.startsWith(VISIBLE_HIDDEN_PREFIX)) return false
	return segments.some((segment) => segment.startsWith("."))
}

export function isCaseOnlyRename(oldPath: string, newPath: string): boolean {
	return (
		oldPath !== newPath &&
		getParentPath(oldPath) === getParentPath(newPath) &&
		oldPath.toLowerCase() === newPath.toLowerCase()
	)
}

export function archiveEntrySegments(entryName: string): string[] {
	const parts = entryName.replaceAll("\\", "/").split("/")
	if (
		entryName.startsWith("/") ||
		/^[A-Za-z]:/u.test(entryName) ||
		parts.some((part) => part === ".." || part.includes("\0"))
	) {
		throw new Error("Archive entry escapes destination")
	}
	return parts.slice(1).filter((part) => part && part !== ".")
}

function parseJsonObject(text: string | null): Record<string, unknown> | null {
	if (!text) return null
	try {
		const parsed = JSON.parse(text) as unknown
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null
	} catch {
		return null
	}
}

function readTrimmedString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null
}

export function parseVaultFile(text: string | null): VaultFile | null {
	const parsed = parseJsonObject(text)
	const id = readTrimmedString(parsed?.id)
	if (!parsed || !id) return null
	return {
		version: typeof parsed.version === "number" ? parsed.version : VAULT_FILE_VERSION,
		id,
		name: readTrimmedString(parsed.name),
		createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date(0).toISOString(),
	}
}

export function serializeVaultFile(file: VaultFile): string {
	return JSON.stringify(file, null, 2)
}

async function readOptionalText(io: VaultTextIo, path: string): Promise<string | null> {
	try {
		return await io.readText(path)
	} catch (error) {
		if (io.isNotFound(error)) return null
		throw error
	}
}

export async function readOrCreateVaultFile(
	vaultPath: string,
	io: VaultTextIo,
): Promise<VaultFile> {
	const vaultFilePath = getVaultFilePath(vaultPath, VAULT_FILES.vault)
	const current = await readOptionalText(io, vaultFilePath)
	const parsed = parseVaultFile(current)
	if (parsed) return parsed
	if (current !== null) throw new Error(`Invalid vault file: ${vaultFilePath}`)
	const file: VaultFile = {
		version: VAULT_FILE_VERSION,
		id: io.createId(),
		name: null,
		createdAt: new Date(io.now?.() ?? Date.now()).toISOString(),
	}
	await io.writeText(vaultFilePath, serializeVaultFile(file))
	return file
}

export function resolveVaultName(file: Pick<VaultFile, "name"> | null, folderPath: string): string {
	return file?.name || getBaseName(folderPath) || "Vault"
}

export function resolveStoredVaultName(vaultFileText: string | null, folderPath: string): string {
	return resolveVaultName(parseVaultFile(vaultFileText), folderPath)
}

export function renameVaultFile(file: VaultFile, name: string): VaultFile | null {
	const nextName = readTrimmedString(name)
	return nextName === file.name ? null : { ...file, name: nextName }
}

function toLastOpenedMs(lastOpened: unknown): number {
	if (typeof lastOpened !== "number" || !Number.isFinite(lastOpened)) return 0
	return lastOpened < SECONDS_TIMESTAMP_LIMIT ? lastOpened * 1000 : lastOpened
}

export function parseVaultRegistry(text: string): VaultRegistryEntry[] {
	const parsed = JSON.parse(text) as unknown
	if (!Array.isArray(parsed)) return []
	return parsed
		.filter(
			(entry): entry is VaultRegistryEntry =>
				Boolean(entry) && typeof entry.uuid === "string" && typeof entry.path === "string",
		)
		.map((entry) => ({ ...entry, lastOpened: toLastOpenedMs(entry.lastOpened) }))
}

export function upsertRegistryEntry(
	entries: readonly VaultRegistryEntry[],
	input: VaultRegistryInput,
	nowMs: number,
): VaultRegistryEntry[] {
	const existing = entries.find((entry) => entry.uuid === input.uuid)
	const entry: VaultRegistryEntry = {
		...existing,
		uuid: input.uuid,
		path: normalizePath(input.path),
		name: input.name,
		lastOpened: nowMs,
		icon: input.icon === undefined ? (existing?.icon ?? null) : input.icon,
		color: input.color === undefined ? (existing?.color ?? null) : input.color,
		displayPath: input.displayPath ?? existing?.displayPath ?? null,
	}
	return existing
		? entries.map((candidate) => (candidate === existing ? entry : candidate))
		: [...entries, entry]
}

export function patchRegistryEntry(
	entries: readonly VaultRegistryEntry[],
	uuid: string,
	patch: VaultRegistryPatch,
): VaultRegistryEntry[] {
	return entries.map((entry) =>
		entry.uuid === uuid
			? {
					...entry,
					path: patch.path === undefined ? entry.path : normalizePath(patch.path),
					color: patch.color === undefined ? (entry.color ?? null) : patch.color,
				}
			: entry,
	)
}

export function sanitizeVaultFolderName(name: string): string {
	return (
		name
			.trim()
			.replace(/[\\/:*?"<>|]/gu, "-")
			.replace(/\p{Cc}/gu, "")
			.replace(/^\.+/u, "")
			.slice(0, 120)
			.trim() || "Vault"
	)
}

export interface FreeVaultFolderDeps {
	join(parent: string, name: string): string
	exists(path: string): Promise<boolean>
}

export async function findFreeVaultFolderName(
	parent: string,
	name: string,
	{ join, exists }: FreeVaultFolderDeps,
): Promise<string> {
	const base = sanitizeVaultFolderName(name)
	for (let attempt = 1; ; attempt += 1) {
		const candidate = join(parent, attempt === 1 ? base : `${base} ${attempt}`)
		if (!(await exists(candidate))) return candidate
	}
}

export function removeRegistryEntry(
	entries: readonly VaultRegistryEntry[],
	uuid: string,
): VaultRegistryEntry[] {
	return entries.filter((entry) => entry.uuid !== uuid)
}

export function sortRecentVaults(entries: readonly VaultRegistryEntry[]): VaultRegistryEntry[] {
	return [...entries].sort(
		(left, right) => toLastOpenedMs(right.lastOpened) - toLastOpenedMs(left.lastOpened),
	)
}

export function getOrCreateDeviceId(store: DeviceIdStore, createId: () => string): string {
	const existing = store.get(DEVICE_ID_KEY)
	if (existing) return existing
	const deviceId = createId()
	store.set(DEVICE_ID_KEY, deviceId)
	return deviceId
}
