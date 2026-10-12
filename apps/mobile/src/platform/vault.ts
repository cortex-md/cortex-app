import type { FileEntry, Platform, VaultMetadata } from "@cortex/platform"
import { getVaultFilePath, joinPath, VAULT_FILES } from "@cortex/platform/utils"
import {
	compareFileEntries,
	isHiddenVaultPath,
	readOrCreateVaultId,
	resolveVaultName,
	type VaultTextIo,
} from "@cortex/platform/vault"
import { Directory, Paths } from "expo-file-system"

import { normalizeUri } from "./appStorage"
import { isNotFoundError } from "./errors"
import { readOptionalTextFile, readTextFile, writeTextFile } from "./fs"
import { normalizeFileEntry, resolveLogicalDirectory, routeStoragePath } from "./pathResolver"
import { vaultRegistryApi } from "./registry"
import {
	findMobileVaultRootByPath,
	getDirectoryName,
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

async function readVaultName(vaultPath: string, folderName: string): Promise<string> {
	const metadataJson = await readOptionalTextFile(
		getVaultFilePath(vaultPath, VAULT_FILES.vaultMetadata),
	)
	return resolveVaultName(metadataJson, folderName)
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
				return {
					displayPath: root.displayPath,
					folderName: getDirectoryName(root.directoryUri),
					vaultPath: root.logicalPath,
				}
			},
			appStorage: (appStoragePath) => {
				const info = Paths.info(appStoragePath)
				if (!info.exists || !info.isDirectory) {
					throw new Error(`Vault path does not exist or is not a directory: ${path}`)
				}
				return {
					displayPath: appStoragePath.replace(/^file:\/\//u, ""),
					folderName: getDirectoryName(appStoragePath),
					vaultPath: appStoragePath,
				}
			},
		},
	)

	const [uuid, name, fileCount] = await Promise.all([
		readOrCreateVaultId(vaultPath, mobileVaultTextIo),
		readVaultName(vaultPath, folderName),
		countFiles ? countVaultFiles(vaultPath) : 0,
	])
	return { displayPath, fileCount, name, path: vaultPath, uuid }
}

export const vaultApi = {
	getVaultMetadata: (path) => describeVault(path, true),
	openVault: (path) => describeVault(path, false),
	scanVault,
	...vaultRegistryApi,
} satisfies Platform["vault"]
