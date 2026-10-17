import type { FileEntry, FileSnapshot, Platform } from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import { getBaseName, joinPath } from "@cortex/platform/utils"
import {
	archiveEntrySegments,
	compareFileEntries,
	isHiddenVaultPath,
	snapshotFromContent,
} from "@cortex/platform/vault"
import { Directory, File, Paths } from "expo-file-system"
import { unzipSync } from "fflate"

import {
	assertSupportedPath,
	atomicWriteAppStorageFile,
	ensureDirectory,
	ensureParentDirectory,
	getExistingAppStorageFile,
	normalizeUri,
	writeAppStorageFile,
} from "./appStorage"
import { isNotFoundError } from "./errors"
import { isMobileVaultLogicalPath } from "./mobile-vault-paths"
import {
	getActualEntryMetadata,
	getEntryMetadata,
	getMobileParentPath,
	normalizeFileEntry,
	resolveEntry,
	resolveLogicalDirectory,
	resolveLogicalFile,
	routeStoragePath,
} from "./pathResolver"
import { notifyLocalFileChange } from "./syncSignals"
import {
	findEntry,
	findMobileVaultRootByPath,
	forgetActualUri,
	listDirectoryEntries,
	rememberActualUri,
} from "./vaultRoots"
import { watcherApi } from "./watcher"

type FileContent = string | Uint8Array

function getProviderMimeType(path: string): string {
	return path.toLowerCase().endsWith(".md") ? "text/markdown" : "application/octet-stream"
}

export async function writeLogicalFile(path: string, content: FileContent): Promise<File> {
	const { file } = await resolveLogicalFile(path, {
		create: true,
		mimeType: getProviderMimeType(path),
	})
	file.write(content)
	return file
}

function resolveExistingFile(path: string, operation: string): Promise<File> {
	return routeStoragePath(path, operation, {
		vault: async (logicalPath) => (await resolveLogicalFile(logicalPath)).file,
		appStorage: (appStoragePath) => getExistingAppStorageFile(appStoragePath, operation),
	})
}

function writeFileHandle(path: string, content: FileContent, operation: string): Promise<File> {
	return routeStoragePath(path, operation, {
		vault: (logicalPath) => writeLogicalFile(logicalPath, content),
		appStorage: (appStoragePath) => writeAppStorageFile(appStoragePath, content),
	})
}

export async function readTextFile(path: string): Promise<string> {
	return (await resolveExistingFile(path, "fs.readFile")).text()
}

export async function writeTextFile(path: string, content: string): Promise<void> {
	await writeFileHandle(path, content, "fs.writeFile")
	notifyLocalFileChange(path)
}

export async function readOptionalTextFile(path: string): Promise<string | null> {
	try {
		return await readTextFile(path)
	} catch (error) {
		if (isNotFoundError(error)) return null
		throw error
	}
}

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Download failed: ${response.status}`)
	return new Uint8Array(await response.arrayBuffer())
}

async function downloadAndExtract(url: string, destDir: string): Promise<void> {
	const archive = unzipSync(await fetchBytes(url))
	await createDir(destDir)
	for (const [entryName, data] of Object.entries(archive)) {
		if (entryName.endsWith("/")) continue
		const segments = archiveEntrySegments(entryName)
		if (segments.length === 0) continue
		await writeFileHandle(joinPath(destDir, segments.join("/")), data, "fs.downloadAndExtract")
	}
}

function createDir(path: string): Promise<void> {
	return routeStoragePath(path, "fs.createDir", {
		vault: async (logicalPath) => {
			await resolveLogicalDirectory(logicalPath, { create: true })
		},
		appStorage: (appStoragePath) => {
			ensureDirectory(new Directory(appStoragePath))
		},
	})
}

async function moveProviderEntry(
	entry: File | Directory,
	parentDirectory: Directory,
	name: string,
): Promise<void> {
	if (entry.name === name) {
		await entry.move(parentDirectory, { overwrite: false })
		return
	}
	if (entry instanceof Directory) {
		const target = parentDirectory.createDirectory(name)
		for (const child of entry.list()) await child.move(target, { overwrite: false })
		entry.delete()
		return
	}
	const bytes = await entry.bytes()
	const target = parentDirectory.createFile(name, getProviderMimeType(name))
	target.write(bytes)
	if (target.size !== bytes.byteLength) {
		target.delete()
		throw new Error(`Could not copy ${entry.name} to ${name}`)
	}
	entry.delete()
}

function createDestinationEntry(
	parentDirectory: Directory,
	path: string,
	isDir: boolean,
): Directory | File {
	const name = getBaseName(path)
	return isDir ? new Directory(parentDirectory, name) : new File(parentDirectory, name)
}

export async function renameFile(
	oldPath: string,
	newPath: string,
	options?: { overwrite?: boolean },
): Promise<void> {
	const source = await resolveEntry(oldPath)
	const supportedOldPath = assertSupportedPath(oldPath, "fs.renameFile")
	const supportedNewPath = assertSupportedPath(newPath, "fs.renameFile")
	if (isMobileVaultLogicalPath(supportedOldPath) !== isMobileVaultLogicalPath(supportedNewPath)) {
		throw new Error("Cannot move files between mobile vault roots and app storage")
	}

	if (isMobileVaultLogicalPath(supportedNewPath)) {
		const destinationParent = await resolveLogicalDirectory(getMobileParentPath(supportedNewPath), {
			create: true,
		})
		const destinationEntry = findEntry(
			destinationParent.directory,
			getBaseName(supportedNewPath),
			await findMobileVaultRootByPath(supportedNewPath),
		)
		if (destinationEntry && supportedOldPath !== supportedNewPath) {
			if (!options?.overwrite) throw new Error("Destination already exists")
			destinationEntry.delete()
		}

		if (source.entry.uri.startsWith("content://")) {
			await moveProviderEntry(
				source.entry,
				destinationParent.directory,
				getBaseName(supportedNewPath),
			)
		} else {
			await source.entry.move(
				createDestinationEntry(destinationParent.directory, supportedNewPath, source.isDir),
				{ overwrite: false },
			)
		}
		forgetActualUri(supportedOldPath)
		return
	}

	const sourceInfo = Paths.info(supportedOldPath)
	const destinationInfo = Paths.info(supportedNewPath)

	if (!sourceInfo.exists) {
		throw new Error(`Source path does not exist: ${oldPath}`)
	}
	if (destinationInfo.exists && supportedOldPath !== supportedNewPath) {
		throw new Error("Destination already exists")
	}

	ensureParentDirectory(supportedNewPath)
	if (sourceInfo.isDirectory) {
		await new Directory(supportedOldPath).move(new Directory(supportedNewPath), {
			overwrite: false,
		})
		return
	}

	await new File(supportedOldPath).move(new File(supportedNewPath), { overwrite: false })
}

function listDir(path: string): Promise<FileEntry[]> {
	return routeStoragePath(path, "fs.listDir", {
		vault: async (logicalPath) => {
			const root = await findMobileVaultRootByPath(logicalPath)
			const directory = await resolveLogicalDirectory(logicalPath)
			const entries: FileEntry[] = []
			for (const entry of listDirectoryEntries(directory.directory, root)) {
				if (isHiddenVaultPath(entry.name)) continue
				const entryPath = joinPath(directory.logicalPath ?? root.logicalPath, entry.name)
				entries.push(normalizeFileEntry(entry, entryPath))
				rememberActualUri(entryPath, entry.uri)
			}
			return entries.sort(compareFileEntries)
		},
		appStorage: (appStoragePath) => {
			const entries: FileEntry[] = []
			for (const entry of new Directory(appStoragePath).list()) {
				if (!isHiddenVaultPath(entry.name)) {
					entries.push(normalizeFileEntry(entry, normalizeUri(entry.uri)))
				}
			}
			return entries.sort(compareFileEntries)
		},
	})
}

export const fsApi = {
	atomicWriteFile: (path, content) =>
		routeStoragePath(path, "fs.atomicWriteFile", {
			vault: async (logicalPath) => {
				await writeLogicalFile(logicalPath, content)
				notifyLocalFileChange(logicalPath)
			},
			appStorage: (appStoragePath) => atomicWriteAppStorageFile(appStoragePath, content),
		}),
	createDir,
	deleteFile: async (path) => {
		const entry = await resolveEntry(path)
		if (entry.logicalPath) forgetActualUri(entry.logicalPath)
		entry.entry.delete()
		notifyLocalFileChange(path, true)
	},
	downloadAndExtract,
	downloadFile: async (url, destPath) => {
		await writeFileHandle(destPath, await fetchBytes(url), "fs.downloadFile")
	},
	getFileMetadata: (path) =>
		routeStoragePath(path, "fs.getFileMetadata", {
			vault: async (logicalPath) => getEntryMetadata((await resolveEntry(logicalPath)).entry),
			appStorage: getActualEntryMetadata,
		}),
	hashFile: async (path) =>
		hashBytes(await (await resolveExistingFile(path, "fs.hashFile")).bytes()),
	listDir,
	readBinaryFile: async (path) => (await resolveExistingFile(path, "fs.readBinaryFile")).bytes(),
	readFile: readTextFile,
	readTextFiles: async (paths) =>
		await Promise.all(
			paths.map(async (path) => {
				try {
					const file = await resolveExistingFile(path, "fs.readTextFiles")
					const content = await file.text()
					return { content, modifiedAt: getEntryMetadata(file).modifiedAt, size: file.size }
				} catch {
					return null
				}
			}),
		),
	readFileSnapshot: async (path): Promise<FileSnapshot> => {
		const file = await resolveExistingFile(path, "fs.readFileSnapshot")
		return snapshotFromContent(await file.text(), getEntryMetadata(file))
	},
	renameFile: async (oldPath, newPath) => {
		await renameFile(oldPath, newPath)
		notifyLocalFileChange(oldPath, true)
		notifyLocalFileChange(newPath)
	},
	writeBinaryFile: async (path, data) => {
		await writeFileHandle(path, data, "fs.writeBinaryFile")
		notifyLocalFileChange(path)
	},
	writeFile: writeTextFile,
	writeFileSnapshot: async (path, content): Promise<FileSnapshot> => {
		const file = await writeFileHandle(path, content, "fs.writeFile")
		notifyLocalFileChange(path)
		return snapshotFromContent(content, getEntryMetadata(file))
	},
	...watcherApi,
} satisfies Platform["fs"]
