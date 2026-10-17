import { promises as fs } from "node:fs"
import { join } from "node:path"
import type { FileEntry, VaultMetadata } from "@cortex/platform"
import { normalizePath } from "@cortex/platform/utils"
import {
	findFreeVaultFolderName,
	isHiddenVaultPath,
	resolveVaultName,
} from "@cortex/platform/vault"
import { app } from "electron"
import type { MainApi } from "../contract"
import { assertAllowedPath, grantPath } from "../security"
import { statsToFileEntry } from "./fs"
import { vaultRegistryApi } from "./registry"
import { readVaultFile } from "./vaultFile"

async function assertDirectory(path: string): Promise<void> {
	const stats = await fs.stat(path).catch(() => null)
	if (!stats?.isDirectory()) {
		throw new Error(`Path does not exist or is not a directory: ${path}`)
	}
}

function defaultVaultLocation(): string {
	return join(app.getPath("documents"), "Cortex")
}

async function nextFreeFolder(parent: string, name: string): Promise<string> {
	return await findFreeVaultFolderName(parent, name, {
		join,
		exists: (candidate) =>
			fs.stat(candidate).then(
				() => true,
				() => false,
			),
	})
}

async function countVaultFiles(dir: string): Promise<number> {
	const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
	const counts = await Promise.all(
		dirents
			.filter((dirent) => !isHiddenVaultPath(dirent.name))
			.map(async (dirent) => {
				if (dirent.isDirectory()) return await countVaultFiles(join(dir, dirent.name))
				return dirent.isFile() ? 1 : 0
			}),
	)
	return counts.reduce((total, count) => total + count, 0)
}

async function scanDirectory(dir: string, isRoot: boolean): Promise<FileEntry[]> {
	const dirents = await fs.readdir(dir, { withFileTypes: true }).catch((error) => {
		if (isRoot) throw error
		return []
	})
	const nested = await Promise.all(
		dirents
			.filter((dirent) => !isHiddenVaultPath(dirent.name))
			.map(async (dirent) => {
				const fullPath = join(dir, dirent.name)
				const stats = await fs.stat(fullPath).catch(() => null)
				if (!stats) return []
				const entry = statsToFileEntry(fullPath, dirent.name, stats)
				return entry.isDir ? [entry, ...(await scanDirectory(fullPath, false))] : [entry]
			}),
	)
	return nested.flat()
}

async function describeVault(path: string, fileCount: number): Promise<VaultMetadata> {
	const file = await readVaultFile(path)
	return { uuid: file.id, path: normalizePath(path), name: resolveVaultName(file, path), fileCount }
}

export const vaultApi = {
	openVault: async (path) => {
		const vaultPath = assertAllowedPath(path)
		await assertDirectory(vaultPath)
		return await describeVault(vaultPath, 0)
	},
	scanVault: async (path) => await scanDirectory(assertAllowedPath(path), true),
	getVaultMetadata: async (path) => {
		const vaultPath = assertAllowedPath(path)
		await assertDirectory(vaultPath)
		return await describeVault(vaultPath, await countVaultFiles(vaultPath))
	},
	getDefaultVaultLocation: async () => normalizePath(defaultVaultLocation()),
	createVaultFolder: async (parentPath, name) => {
		const parent = parentPath ? assertAllowedPath(parentPath) : defaultVaultLocation()
		const folder = await nextFreeFolder(parent, name)
		await fs.mkdir(folder, { recursive: true })
		grantPath(folder)
		return normalizePath(folder)
	},
	pathExists: async (path) => {
		const stats = await fs.stat(assertAllowedPath(path)).catch(() => null)
		return Boolean(stats?.isDirectory())
	},
	...vaultRegistryApi,
} satisfies MainApi["vault"]
