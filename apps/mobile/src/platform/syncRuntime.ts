import { toVaultRelativePath } from "@cortex/platform/utils"
import type {
	SqlDatabase,
	SqlValue,
	SyncDirEntry,
	SyncFileStats,
	SyncFs,
	SyncRuntime,
} from "@cortex/sync-engine"
import * as ExpoCrypto from "expo-crypto"
import { Directory, File } from "expo-file-system"
import { openDatabaseSync } from "expo-sqlite"

import { ensureDirectory, getAppDirectory } from "./appStorage"
import { isNotFoundError } from "./errors"
import { renameFile, writeLogicalFile } from "./fs"
import { getMobileVaultPathParts } from "./mobile-vault-paths"
import { resolveEntry, resolveLogicalDirectory } from "./pathResolver"
import { mobileCrypto } from "./syncCrypto"
import { findMobileVaultRootByPath, listDirectoryEntries } from "./vaultRoots"
import { emitSyntheticWatchEvent } from "./watcher"

const SYNC_DB_RELATIVE_PATH = ".cortex/sync.db"

function normalizeSegments(path: string): string {
	const segments: string[] = []
	for (const segment of path.split("/")) {
		if (!segment || segment === ".") continue
		if (segment === "..") segments.pop()
		else segments.push(segment)
	}
	return `/${segments.join("/")}`
}

function join(...parts: string[]): string {
	return normalizeSegments(parts.filter(Boolean).join("/"))
}

function resolve(...parts: string[]): string {
	let resolved = "/"
	for (const part of parts) {
		if (!part) continue
		resolved = part.startsWith("/") ? part : `${resolved}/${part}`
	}
	return normalizeSegments(resolved)
}

function dirname(path: string): string {
	const normalized = normalizeSegments(path)
	const index = normalized.lastIndexOf("/")
	return index <= 0 ? "/" : normalized.slice(0, index)
}

function relative(from: string, to: string): string {
	const source = resolve(from).split("/").filter(Boolean)
	const target = resolve(to).split("/").filter(Boolean)
	let shared = 0
	while (shared < source.length && source[shared] === target[shared]) shared++
	return [...source.slice(shared).map(() => ".."), ...target.slice(shared)].join("/")
}

function notFound(path: string, cause?: unknown): Error {
	return Object.assign(new Error(`ENOENT: no such file or directory, ${path}`, { cause }), {
		code: "ENOENT",
		path,
		syscall: "stat",
	})
}

async function withNotFound<T>(path: string, run: () => Promise<T>): Promise<T> {
	try {
		return await run()
	} catch (error) {
		if (isNotFoundError(error)) throw notFound(path, error)
		throw error
	}
}

async function directEntry(path: string): Promise<File | Directory | null> {
	const root = await findMobileVaultRootByPath(path)
	if (!root.directoryUri.startsWith("file://")) return null
	const relativePath = toVaultRelativePath(path, root.logicalPath)
	if (relativePath === null) return null
	if (!relativePath) return new Directory(root.directoryUri)
	const segments = relativePath.split("/")
	const directory = new Directory(root.directoryUri, ...segments)
	if (directory.exists) return directory
	return new File(root.directoryUri, ...segments)
}

async function resolveExisting(path: string): Promise<File | Directory> {
	const direct = await directEntry(path)
	if (direct) {
		if (!direct.exists) throw notFound(path)
		return direct
	}
	return (await withNotFound(path, () => resolveEntry(path))).entry
}

async function statEntry(path: string): Promise<SyncFileStats> {
	const entry = await resolveExisting(path)
	const info = entry.info()
	const isFile = entry instanceof File
	return {
		size: info.size ?? 0,
		mtimeMs: info.modificationTime ?? 0,
		isFile: () => isFile,
	}
}

async function readFileEntry(path: string): Promise<File> {
	const entry = await resolveExisting(path)
	if (!(entry instanceof File)) throw notFound(path)
	return entry
}

function syncDbFile(path: string): File | null {
	const parts = getMobileVaultPathParts(path)
	if (!parts || parts.relativePath !== SYNC_DB_RELATIVE_PATH) return null
	const directory = new Directory(getAppDirectory(), "sync")
	ensureDirectory(directory)
	return new File(directory, `${parts.rootId}.db`)
}

function toSqlitePath(uri: string): string {
	return decodeURIComponent(uri.replace(/^file:\/\//u, ""))
}

function bindValues(params: SqlValue[]) {
	return params.map((value) => (typeof value === "bigint" ? Number(value) : value))
}

function openDatabase(path: string): SqlDatabase {
	const target = syncDbFile(path)
	if (!target) throw new Error(`Unsupported sync database location: ${path}`)
	const directory = toSqlitePath(target.parentDirectory.uri)
	const database = openDatabaseSync(target.name, undefined, directory)
	let open = true
	return {
		get isOpen() {
			return open
		},
		exec: (sql) => database.execSync(sql),
		prepare: (sql) => {
			const statement = database.prepareSync(sql)
			return {
				run: (...params: SqlValue[]) => statement.executeSync(bindValues(params)),
				get: (...params: SqlValue[]) =>
					statement.executeSync(bindValues(params)).getFirstSync() ?? undefined,
				all: (...params: SqlValue[]) => statement.executeSync(bindValues(params)).getAllSync(),
			}
		},
		close: () => {
			open = false
			database.closeSync()
		},
	}
}

const mobileSyncFs: SyncFs = {
	readFile: async (path) => (await readFileEntry(path)).bytes(),
	readTextFile: async (path) => (await readFileEntry(path)).text(),
	writeFile: async (path, content) => {
		await writeLogicalFile(path, content)
		emitSyntheticWatchEvent(path, "created")
	},
	stat: statEntry,
	lstat: statEntry,
	readdir: async (path) => {
		const root = await findMobileVaultRootByPath(path)
		const direct = await directEntry(path)
		const directory =
			direct instanceof Directory
				? direct
				: (await withNotFound(path, () => resolveLogicalDirectory(path))).directory
		return listDirectoryEntries(directory, root).map(
			(entry): SyncDirEntry => ({
				name: entry.name,
				isFile: () => entry instanceof File,
				isDirectory: () => entry instanceof Directory,
				isSymbolicLink: () => false,
			}),
		)
	},
	mkdir: async (path) => {
		await resolveLogicalDirectory(path, { create: true })
		emitSyntheticWatchEvent(path, "created")
	},
	mkdirSync: () => {},
	rename: async (oldPath, newPath) => {
		await renameFile(oldPath, newPath, { overwrite: true })
		emitSyntheticWatchEvent(oldPath, "deleted")
		emitSyntheticWatchEvent(newPath, "created")
	},
	rm: async (path) => {
		try {
			const entry = await resolveExisting(path)
			entry.delete()
			emitSyntheticWatchEvent(path, "deleted")
		} catch (error) {
			if ((error as { code?: string }).code !== "ENOENT") throw error
		}
	},
	existsSync: (path) => syncDbFile(path)?.exists ?? false,
}

export const mobileSyncRuntime: SyncRuntime = {
	crypto: mobileCrypto,
	fs: mobileSyncFs,
	path: { join, dirname, resolve, relative, isAbsolute: (path) => path.startsWith("/") },
	openDatabase,
	randomUUID: () => ExpoCrypto.randomUUID(),
}
