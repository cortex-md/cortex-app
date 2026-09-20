import { existsSync, lstatSync, mkdirSync, promises as fs, statSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import { randomUUID } from "node:crypto"
import AdmZip from "adm-zip"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import writeFileAtomic from "write-file-atomic"
import { normalizePath } from "../paths"

export interface FileEntry {
	path: string
	name: string
	isDir: boolean
	size: number
	mtime: number
}

export interface FileMetadata {
	createdAt: number
	modifiedAt: number
}

export interface FileSnapshot {
	content: string
	hash: string
	metadata: FileMetadata
}

function toMillis(timeMs: number): number {
	return Math.floor(timeMs)
}

function fallbackFileMetadata(): FileMetadata {
	const now = Date.now()
	return { createdAt: now, modifiedAt: now }
}

async function readFileMetadata(path: string): Promise<FileMetadata> {
	const metadata = await fs.stat(path)
	const modifiedAt = toMillis(metadata.mtimeMs)
	const createdAt = metadata.birthtimeMs > 0 ? toMillis(metadata.birthtimeMs) : modifiedAt
	return { createdAt, modifiedAt }
}

function hashBytes(data: Buffer | string): string {
	const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
	return bytesToHex(blake3(bytes))
}

export async function readFile(path: string): Promise<string> {
	return await fs.readFile(path, "utf8")
}

export async function readFileSnapshot(path: string): Promise<FileSnapshot> {
	const data = await fs.readFile(path)
	const hash = hashBytes(data)
	const content = data.toString("utf8")
	const metadata = await readFileMetadata(path)
	return { content, hash, metadata }
}

export async function readBinaryFile(path: string): Promise<number[]> {
	const data = await fs.readFile(path)
	return Array.from(data)
}

export async function writeFileSnapshot(path: string, content: string): Promise<FileSnapshot> {
	await fs.mkdir(dirname(path), { recursive: true })
	await fs.writeFile(path, content, "utf8")
	const hash = hashBytes(content)
	let metadata: FileMetadata
	try {
		metadata = await readFileMetadata(path)
	} catch {
		metadata = fallbackFileMetadata()
	}
	return { content, hash, metadata }
}

export async function writeFile(path: string, content: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true })
	await fs.writeFile(path, content, "utf8")
}

export async function atomicWriteFile(path: string, content: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true })
	await writeFileAtomic(path, content, "utf8")
}

export async function writeBinaryFile(path: string, data: number[]): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true })
	await fs.writeFile(path, Buffer.from(data))
}

export async function deleteFile(path: string): Promise<void> {
	const metadata = await fs.lstat(path)
	if (metadata.isDirectory()) {
		await fs.rm(path, { recursive: true, force: true })
	} else {
		await fs.unlink(path)
	}
}

function isCaseOnlyRename(oldPath: string, newPath: string): boolean {
	const oldDir = dirname(oldPath)
	const newDir = dirname(newPath)
	if (oldDir !== newDir) return false
	const oldName = oldPath.slice(oldDir.length + 1)
	const newName = newPath.slice(newDir.length + 1)
	return oldName !== newName && oldName.toLowerCase() === newName.toLowerCase()
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
	if (oldPath === newPath) return
	await fs.mkdir(dirname(newPath), { recursive: true })

	const caseOnly = isCaseOnlyRename(oldPath, newPath)
	if (existsSync(newPath) && !caseOnly) {
		throw new Error("Destination already exists")
	}

	if (!caseOnly) {
		await fs.rename(oldPath, newPath)
		return
	}

	const parent = dirname(oldPath)
	const temporaryPath = join(parent, `.cortex-rename-${randomUUID()}`)
	await fs.rename(oldPath, temporaryPath)
	if (existsSync(newPath)) {
		await fs.rename(temporaryPath, oldPath).catch(() => undefined)
		throw new Error("Destination already exists")
	}
	try {
		await fs.rename(temporaryPath, newPath)
	} catch (error) {
		await fs.rename(temporaryPath, oldPath).catch(() => undefined)
		throw error
	}
}

export async function createDir(path: string): Promise<void> {
	await fs.mkdir(path, { recursive: true })
}

export async function hashFile(path: string): Promise<string> {
	const data = await fs.readFile(path)
	return hashBytes(data)
}

export async function getFileMetadata(path: string): Promise<FileMetadata> {
	return await readFileMetadata(path)
}

export async function listDir(path: string): Promise<FileEntry[]> {
	const dirents = await fs.readdir(path, { withFileTypes: true })
	const entries: FileEntry[] = []
	for (const dirent of dirents) {
		if (dirent.name.startsWith(".")) continue
		const fullPath = join(path, dirent.name)
		let metadata: ReturnType<typeof statSync>
		try {
			metadata = await fs.stat(fullPath)
		} catch {
			continue
		}
		entries.push({
			path: normalizePath(fullPath),
			name: dirent.name,
			isDir: metadata.isDirectory(),
			size: metadata.size,
			mtime: Math.floor(metadata.mtimeMs / 1000),
		})
	}
	entries.sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
		return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
	})
	return entries
}

export async function downloadFile(url: string, destPath: string): Promise<void> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Download failed: ${response.status}`)
	}
	const bytes = Buffer.from(await response.arrayBuffer())
	await fs.mkdir(dirname(destPath), { recursive: true })
	await fs.writeFile(destPath, bytes)
}

export async function downloadText(url: string): Promise<string> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Download failed: ${response.status}`)
	}
	return await response.text()
}

function hasWindowsPrefix(path: string): boolean {
	const normalized = path.replaceAll("\\", "/")
	if (normalized.startsWith("//")) return true
	const first = normalized.split("/")[0] ?? ""
	return first.length === 2 && /[A-Za-z]/.test(first[0]!) && first[1] === ":"
}

function validateArchiveEntryPath(path: string): void {
	if (path.startsWith("/") || hasWindowsPrefix(path)) {
		throw new Error("Archive entry escapes destination")
	}
	for (const part of path.replaceAll("\\", "/").split("/")) {
		if (part === "..") {
			throw new Error("Archive entry escapes destination")
		}
	}
}

function safeArchiveOutputPath(dest: string, rawName: string): string | null {
	validateArchiveEntryPath(rawName)
	const slashIndex = rawName.indexOf("/")
	const stripped = slashIndex >= 0 ? rawName.slice(slashIndex + 1) : rawName
	if (!stripped) return null
	validateArchiveEntryPath(stripped)

	const parts = stripped
		.replaceAll("\\", "/")
		.split("/")
		.filter((part) => part && part !== ".")
	if (parts.some((part) => part === "..")) {
		throw new Error("Archive entry escapes destination")
	}
	if (parts.length === 0) {
		throw new Error("Archive entry has no output path")
	}
	return join(dest, ...parts)
}

export async function downloadAndExtract(url: string, destDir: string): Promise<void> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Download failed: ${response.status}`)
	}
	const bytes = Buffer.from(await response.arrayBuffer())
	await fs.mkdir(destDir, { recursive: true })
	const canonicalDest = resolve(destDir)
	const zip = new AdmZip(bytes)

	for (const entry of zip.getEntries()) {
		const mode = entry.header?.attr ? (entry.header.attr >>> 16) & 0xffff : undefined
		if (mode !== undefined && (mode & 0o170000) === 0o120000) {
			throw new Error("Archive entry cannot be a symlink")
		}

		const outPath = safeArchiveOutputPath(canonicalDest, entry.entryName)
		if (!outPath) continue

		const resolvedOut = resolve(outPath)
		if (!resolvedOut.startsWith(canonicalDest + sep) && resolvedOut !== canonicalDest) {
			throw new Error("Archive entry escapes destination")
		}

		mkdirSync(dirname(outPath), { recursive: true })
		const resolvedParent = resolve(dirname(outPath))
		if (!resolvedParent.startsWith(canonicalDest + sep) && resolvedParent !== canonicalDest) {
			throw new Error("Archive entry escapes destination")
		}

		if (existsSync(outPath) && lstatSync(outPath).isSymbolicLink()) {
			throw new Error("Archive entry targets a symlink")
		}

		if (entry.isDirectory) {
			mkdirSync(outPath, { recursive: true })
			continue
		}

		await fs.writeFile(outPath, entry.getData())
	}
}
