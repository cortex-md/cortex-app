import { hashBytes } from "./hash"
import type { FileEntry, FileMetadata, FileSnapshot } from "./interfaces/FileSystem"
import type { VaultRegistryEntry } from "./interfaces/Vault"
import {
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
}

export interface VaultRegistryInput {
	uuid: string
	path: string
	name: string
	icon?: string | null
	displayPath?: string | null
}

export interface VaultMetadataFile {
	version: number
	name: string
	createdAt: string
}

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
	if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
	return left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
}

export function snapshotFromContent(content: string, metadata: FileMetadata): FileSnapshot {
	return { content, hash: hashBytes(content), metadata }
}

export function isInternalVaultFile(relativePath: string): boolean {
	return relativePath === VAULT_FILES.searchIndex || relativePath.startsWith(VAULT_FILES.syncDb)
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

export function parseVaultIdentity(text: string): string | null {
	try {
		const uuid = (JSON.parse(text) as { uuid?: unknown } | null)?.uuid
		return typeof uuid === "string" && uuid.trim() ? uuid : null
	} catch {
		return null
	}
}

export async function readOrCreateVaultId(vaultPath: string, io: VaultTextIo): Promise<string> {
	const identityPath = getVaultFilePath(vaultPath, VAULT_FILES.vaultId)
	let text: string
	try {
		text = await io.readText(identityPath)
	} catch (error) {
		if (!io.isNotFound(error)) throw error
		const uuid = io.createId()
		await io.writeText(identityPath, JSON.stringify({ uuid }, null, 2))
		return uuid
	}
	const uuid = parseVaultIdentity(text)
	if (!uuid) throw new Error(`Invalid vault identity file: ${identityPath}`)
	return uuid
}

function parseVaultMetadata(metadataJson: string | null): Partial<VaultMetadataFile> | null {
	if (!metadataJson) return null
	try {
		const parsed = JSON.parse(metadataJson) as unknown
		return parsed && typeof parsed === "object" ? (parsed as Partial<VaultMetadataFile>) : null
	} catch {
		return null
	}
}

export function resolveVaultName(metadataJson: string | null, folderPath: string): string {
	const name = parseVaultMetadata(metadataJson)?.name
	if (typeof name === "string" && name.trim()) return name.trim()
	return getBaseName(folderPath) || "Vault"
}

export function serializeVaultMetadata(
	name: string,
	existingJson: string | null,
	nowMs: number,
): string {
	const existing = parseVaultMetadata(existingJson)
	const metadata: VaultMetadataFile = {
		version: typeof existing?.version === "number" ? existing.version : 1,
		name,
		createdAt:
			typeof existing?.createdAt === "string" ? existing.createdAt : new Date(nowMs).toISOString(),
	}
	return JSON.stringify(metadata, null, 2)
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
		displayPath: input.displayPath ?? existing?.displayPath ?? null,
	}
	return existing
		? entries.map((candidate) => (candidate === existing ? entry : candidate))
		: [...entries, entry]
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
