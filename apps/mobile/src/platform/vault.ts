import type { FileEntry, Platform, VaultMetadata } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"
import {
	compareFileEntries,
	isHiddenVaultPath,
	readOrCreateVaultFile,
	resolveVaultName,
	type VaultTextIo,
} from "@cortex/platform/vault"
import { Directory, Paths } from "expo-file-system"

import { normalizeUri } from "./appStorage"
import { isNotFoundError } from "./errors"
import { readTextFile, writeTextFile } from "./fs"
import { isMobileVaultLogicalPath } from "./mobile-vault-paths"
import { normalizeFileEntry, resolveLogicalDirectory, routeStoragePath } from "./pathResolver"
import { vaultRegistryApi } from "./registry"
import {
	createInternalVaultRoot,
	findMobileVaultRootByPath,
	getDirectoryName,
	getMobileVaultAccess,
	getRootFolderName,
	listDirectoryEntries,
	type MobileVaultRootRecord,
	rememberActualUri,
} from "./vaultRoots"

const mobileVaultTextIo: VaultTextIo = {
	createId: () => crypto.randomUUID(),
	isNotFound: isNotFoundError,
	readText: readTextFile,
	writeText: writeTextFile,
}

function scanDirectory(
	directory: Directory,
	logicalDirectoryPath: string,
	files: FileEntry[],
	record: MobileVaultRootRecord,
): void {
	for (const entry of listDirectoryEntries(directory, record)) {
		if (isHiddenVaultPath(entry.name)) continue
		const logicalPath = joinPath(logicalDirectoryPath, entry.name)
		const fileEntry = normalizeFileEntry(entry, logicalPath)
		files.push(fileEntry)
		rememberActualUri(logicalPath, entry.uri)
		if (fileEntry.isDir) {
			scanDirectory(entry as Directory, logicalPath, files, record)
		}
	}
}

function scanAppStorageDirectory(directory: Directory, files: FileEntry[]): void {
	for (const entry of directory.list()) {
		if (isHiddenVaultPath(entry.name)) continue
		const fileEntry = normalizeFileEntry(entry, normalizeUri(entry.uri))
		files.push(fileEntry)
		if (fileEntry.isDir) {
			scanAppStorageDirectory(new Directory(fileEntry.path), files)
		}
	}
}

function scanVault(path: string): Promise<FileEntry[]> {
	return routeStoragePath(path, "vault.scanVault", {
		vault: async (logicalPath) => {
			const root = await findMobileVaultRootByPath(logicalPath)
			const directory = await resolveLogicalDirectory(root.logicalPath)
			const files: FileEntry[] = []
			scanDirectory(directory.directory, root.logicalPath, files, root)
			return files.sort(compareFileEntries)
		},
		appStorage: (appStoragePath) => {
			const files: FileEntry[] = []
			scanAppStorageDirectory(new Directory(appStoragePath), files)
			return files.sort(compareFileEntries)
		},
	})
}

async function countVaultFiles(vaultPath: string): Promise<number> {
	return (await scanVault(vaultPath)).filter((file) => !file.isDir).length
}

interface VaultLocation {
	displayPath: string
	folderName: string
	vaultPath: string
}

async function describeVault(path: string, countFiles: boolean): Promise<VaultMetadata> {
	const { displayPath, folderName, vaultPath } = await routeStoragePath<VaultLocation>(
		path,
		"vault.getVaultMetadata",
		{
			vault: async (logicalPath) => {
				const root = await findMobileVaultRootByPath(logicalPath)
				const folderName = getRootFolderName(root)
				return {
					displayPath: folderName,
					folderName,
					vaultPath: root.logicalPath,
				}
			},
			appStorage: (appStoragePath) => {
				const info = Paths.info(appStoragePath)
				if (!info.exists || !info.isDirectory) {
					throw new Error(`Vault path does not exist or is not a directory: ${path}`)
				}
				const folderName = getDirectoryName(appStoragePath)
				return {
					displayPath: folderName,
					folderName,
					vaultPath: appStoragePath,
				}
			},
		},
	)

	const [vaultFile, fileCount] = await Promise.all([
		readOrCreateVaultFile(vaultPath, mobileVaultTextIo),
		countFiles ? countVaultFiles(vaultPath) : 0,
	])
	const storedName = resolveVaultName(vaultFile, folderName)
	const name = storedName === vaultFile.id ? folderName : storedName
	return { displayPath, fileCount, name, path: vaultPath, uuid: vaultFile.id }
}

async function createVaultFolder(parentPath: string | null, name: string): Promise<string> {
	if (parentPath !== null) {
		throw new Error("Cortex Mobile creates new vaults in its own storage.")
	}
	return createInternalVaultRoot(name)
}

async function pathExists(path: string): Promise<boolean> {
	if (!isMobileVaultLogicalPath(path)) return Paths.info(path).exists
	return (await getMobileVaultAccess(path)) !== "missing"
}

export const vaultApi = {
	createVaultFolder,
	getVaultMetadata: (path) => describeVault(path, true),
	openVault: (path) => describeVault(path, false),
	pathExists,
	scanVault,
	...vaultRegistryApi,
} satisfies Platform["vault"]
