import { existsSync, mkdirSync, promises as fs } from "node:fs"
import { basename, join } from "node:path"
import { randomUUID } from "node:crypto"
import type { FileEntry } from "./fs"
import { normalizePath } from "../paths"

export interface VaultMetadata {
	uuid: string
	path: string
	name: string
	fileCount: number
}

interface VaultIdentity {
	uuid: string
}

function ensureCortexDir(vaultPath: string): void {
	mkdirSync(join(vaultPath, ".cortex"), { recursive: true })
}

async function readOrCreateVaultId(vaultPath: string): Promise<string> {
	const idPath = join(vaultPath, ".cortex", "vault-id.json")
	if (existsSync(idPath)) {
		const content = await fs.readFile(idPath, "utf8")
		const identity = JSON.parse(content) as VaultIdentity
		return identity.uuid
	}
	const uuid = randomUUID()
	await fs.writeFile(idPath, JSON.stringify({ uuid }, null, 2), "utf8")
	return uuid
}

export async function openVault(path: string): Promise<VaultMetadata> {
	if (!existsSync(path)) {
		throw new Error(`Path does not exist or is not a directory: ${path}`)
	}
	const metadata = await fs.stat(path)
	if (!metadata.isDirectory()) {
		throw new Error(`Path does not exist or is not a directory: ${path}`)
	}
	ensureCortexDir(path)
	const uuid = await readOrCreateVaultId(path)
	return {
		uuid,
		path: normalizePath(path),
		name: basename(path) || "Vault",
		fileCount: 0,
	}
}

async function scanRecursive(
	dir: string,
	files: FileEntry[],
	isRoot: boolean,
): Promise<void> {
	let dirents
	try {
		dirents = await fs.readdir(dir, { withFileTypes: true })
	} catch (error) {
		if (isRoot) throw error
		return
	}

	for (const dirent of dirents) {
		if (dirent.name.startsWith(".")) continue
		const fullPath = join(dir, dirent.name)
		let metadata
		try {
			metadata = await fs.stat(fullPath)
		} catch {
			continue
		}
		const isDir = metadata.isDirectory()
		files.push({
			path: normalizePath(fullPath),
			name: dirent.name,
			isDir,
			size: metadata.size,
			mtime: Math.floor(metadata.mtimeMs / 1000),
		})
		if (isDir) {
			await scanRecursive(fullPath, files, false)
		}
	}
}

export async function scanVault(path: string): Promise<FileEntry[]> {
	const files: FileEntry[] = []
	await scanRecursive(path, files, true)
	return files
}

export async function getVaultMetadata(path: string): Promise<VaultMetadata> {
	if (!existsSync(path)) {
		throw new Error(`Vault path does not exist: ${path}`)
	}
	ensureCortexDir(path)
	const uuid = await readOrCreateVaultId(path)
	let files: FileEntry[] = []
	try {
		files = await scanVault(path)
	} catch {
		files = []
	}
	return {
		uuid,
		path: normalizePath(path),
		name: basename(path) || "Vault",
		fileCount: files.filter((entry) => !entry.isDir).length,
	}
}
