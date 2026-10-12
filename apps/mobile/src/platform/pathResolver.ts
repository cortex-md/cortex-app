import type { FileEntry, FileMetadata } from "@cortex/platform"
import {
	getBaseName,
	getParentPath,
	joinPath,
	normalizePath,
	toVaultRelativePath,
} from "@cortex/platform/utils"
import { toFileEntry, toFileMetadata } from "@cortex/platform/vault"
import { Directory, File } from "expo-file-system"

import { assertSupportedPath, isActualDirectoryPath } from "./appStorage"
import { MobilePathNotFoundError } from "./errors"
import { isMobileVaultLogicalPath } from "./mobile-vault-paths"
import {
	findDirectory,
	findEntry,
	findFile,
	findMobileVaultRootByPath,
	rememberActualUri,
} from "./vaultRoots"

export interface ResolvedDirectory {
	directory: Directory
	logicalPath: string | null
}

export interface ResolvedFile {
	file: File
	logicalPath: string | null
}

export type ResolvedEntry =
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

interface StoragePathRoutes<T> {
	vault: (logicalPath: string) => T | Promise<T>
	appStorage: (appStoragePath: string) => T | Promise<T>
}

export async function routeStoragePath<T>(
	path: string,
	operation: string,
	routes: StoragePathRoutes<T>,
): Promise<T> {
	const supportedPath = assertSupportedPath(path, operation)
	return isMobileVaultLogicalPath(supportedPath)
		? routes.vault(supportedPath)
		: routes.appStorage(supportedPath)
}

export function getMobileParentPath(path: string): string {
	return getParentPath(path) || "/"
}

function getEntryInfo(entry: File | Directory) {
	return entry instanceof Directory ? entry.info() : entry.info()
}

export function getEntryMetadata(entry: File | Directory): FileMetadata {
	const info = getEntryInfo(entry)
	return toFileMetadata({
		birthtimeMs: info.creationTime ?? 0,
		mtimeMs: info.modificationTime ?? Date.now(),
	})
}

export function getActualEntryMetadata(path: string): FileMetadata {
	return getEntryMetadata(isActualDirectoryPath(path) ? new Directory(path) : new File(path))
}

export function normalizeFileEntry(entry: File | Directory, path: string): FileEntry {
	const info = getEntryInfo(entry)
	return toFileEntry({
		isDir: entry instanceof Directory,
		mtimeMs: info.modificationTime ?? 0,
		name: entry.name,
		path,
		size: info.size ?? 0,
	})
}

export async function resolveLogicalDirectory(
	path: string,
	options?: { create?: boolean },
): Promise<ResolvedDirectory> {
	const normalizedPath = normalizePath(path)
	const root = await findMobileVaultRootByPath(normalizedPath)
	const rootDirectory = new Directory(root.directoryUri)
	const relativePath = toVaultRelativePath(normalizedPath, root.logicalPath)
	if (relativePath === null) throw new Error(`${path} is not inside ${root.logicalPath}`)

	if (!relativePath) {
		rememberActualUri(root.logicalPath, root.directoryUri)
		return {
			directory: rootDirectory,
			logicalPath: root.logicalPath,
		}
	}

	let currentDirectory = rootDirectory
	let currentLogicalPath = root.logicalPath
	for (const segment of relativePath.split("/")) {
		currentLogicalPath = joinPath(currentLogicalPath, segment)
		let nextDirectory = findDirectory(currentDirectory, segment, root)
		if (!nextDirectory) {
			if (!options?.create) {
				throw new MobilePathNotFoundError(`Directory does not exist: ${normalizedPath}`)
			}
			nextDirectory = currentDirectory.createDirectory(segment)
		}
		rememberActualUri(currentLogicalPath, nextDirectory.uri)
		currentDirectory = nextDirectory
	}

	return {
		directory: currentDirectory,
		logicalPath: normalizedPath,
	}
}

export async function resolveLogicalFile(
	path: string,
	options?: { create?: boolean; mimeType?: string | null },
): Promise<ResolvedFile> {
	const normalizedPath = normalizePath(path)
	const parentPath = getMobileParentPath(normalizedPath)
	const fileName = getBaseName(normalizedPath)
	const parent = await resolveLogicalDirectory(parentPath, { create: options?.create })
	let file = findFile(parent.directory, fileName, await findMobileVaultRootByPath(normalizedPath))

	if (!file) {
		if (!options?.create) {
			throw new MobilePathNotFoundError(`File does not exist: ${normalizedPath}`)
		}
		file = parent.directory.createFile(fileName, options.mimeType ?? null)
	}

	rememberActualUri(normalizedPath, file.uri)

	return {
		file,
		logicalPath: normalizedPath,
	}
}

async function resolveLogicalEntry(path: string): Promise<ResolvedEntry> {
	const normalizedPath = normalizePath(path)
	const root = await findMobileVaultRootByPath(normalizedPath)
	if (normalizedPath === root.logicalPath) {
		return {
			entry: new Directory(root.directoryUri),
			isDir: true,
			logicalPath: root.logicalPath,
		}
	}

	const parent = await resolveLogicalDirectory(getMobileParentPath(normalizedPath))
	const entry = findEntry(parent.directory, getBaseName(normalizedPath), root)
	if (!entry) throw new MobilePathNotFoundError(`Path does not exist: ${normalizedPath}`)

	rememberActualUri(normalizedPath, entry.uri)

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

function getAppStorageEntry(path: string): ResolvedEntry {
	if (isActualDirectoryPath(path)) {
		return {
			entry: new Directory(path),
			isDir: true,
			logicalPath: null,
		}
	}

	return {
		entry: new File(path),
		isDir: false,
		logicalPath: null,
	}
}

export function resolveEntry(path: string): Promise<ResolvedEntry> {
	return routeStoragePath(path, "fs.resolve", {
		vault: resolveLogicalEntry,
		appStorage: getAppStorageEntry,
	})
}
