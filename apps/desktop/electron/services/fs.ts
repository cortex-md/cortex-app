import { randomUUID } from "node:crypto"
import type { Stats } from "node:fs"
import { promises as fs, constants as fsConstants } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import type { FileEntry, FileMetadata, FileSnapshot, TextFileRead } from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import {
	archiveEntrySegments,
	compareFileEntries,
	isCaseOnlyRename,
	isHiddenVaultPath,
	snapshotFromContent,
	toFileEntry,
	toFileMetadata,
} from "@cortex/platform/vault"
import AdmZip from "adm-zip"
import writeFileAtomic from "write-file-atomic"
import type { MainApi } from "../contract"
import { assertAllowedPath } from "../security"
import { startWatching, stopWatching } from "./watcher"

export function statsToFileEntry(path: string, name: string, stats: Stats): FileEntry {
	return toFileEntry({
		path,
		name,
		isDir: stats.isDirectory(),
		size: stats.size,
		mtimeMs: stats.mtimeMs,
	})
}

async function readFileMetadata(path: string): Promise<FileMetadata> {
	return toFileMetadata(await fs.stat(path))
}

async function writeWithParents(path: string, data: string | Uint8Array): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true })
	await fs.writeFile(path, data)
}

async function exists(path: string): Promise<boolean> {
	return await fs.access(path).then(
		() => true,
		() => false,
	)
}

async function renameFile(oldPath: string, newPath: string): Promise<void> {
	if (oldPath === newPath) return
	await fs.mkdir(dirname(newPath), { recursive: true })
	const caseOnly = isCaseOnlyRename(oldPath, newPath)
	if (!caseOnly) {
		if (await exists(newPath)) throw new Error("Destination already exists")
		await fs.rename(oldPath, newPath)
		return
	}
	const temporaryPath = join(dirname(oldPath), `.cortex-rename-${randomUUID()}`)
	await fs.rename(oldPath, temporaryPath)
	try {
		await fs.rename(temporaryPath, newPath)
	} catch (error) {
		await fs.rename(temporaryPath, oldPath).catch(() => undefined)
		throw error
	}
}

async function listDir(path: string): Promise<FileEntry[]> {
	const dirents = await fs.readdir(path, { withFileTypes: true })
	const entries = await Promise.all(
		dirents
			.filter((dirent) => !isHiddenVaultPath(dirent.name))
			.map(async (dirent) => {
				const fullPath = join(path, dirent.name)
				const stats = await fs.stat(fullPath).catch(() => null)
				return stats ? statsToFileEntry(fullPath, dirent.name, stats) : null
			}),
	)
	return entries.filter((entry): entry is FileEntry => entry !== null).sort(compareFileEntries)
}

async function fetchOk(url: string): Promise<Response> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Download failed: ${response.status}`)
	return response
}

function archiveOutputPath(destination: string, entryName: string): string | null {
	const relativeParts = archiveEntrySegments(entryName)
	if (relativeParts.length === 0) return null
	const outputPath = resolve(destination, ...relativeParts)
	if (!outputPath.startsWith(destination + sep)) {
		throw new Error("Archive entry escapes destination")
	}
	return outputPath
}

async function downloadAndExtract(url: string, destDir: string): Promise<void> {
	const archive = new AdmZip(Buffer.from(await (await fetchOk(url)).arrayBuffer()))
	const destination = resolve(destDir)
	await fs.mkdir(destination, { recursive: true })
	for (const entry of archive.getEntries()) {
		const mode = entry.header?.attr ? (entry.header.attr >>> 16) & 0xffff : 0
		if ((mode & 0o170000) === 0o120000) throw new Error("Archive entry cannot be a symlink")
		const outputPath = archiveOutputPath(destination, entry.entryName)
		if (!outputPath) continue
		if (entry.isDirectory) {
			await fs.mkdir(outputPath, { recursive: true })
			continue
		}
		const existing = await fs.lstat(outputPath).catch(() => null)
		if (existing?.isSymbolicLink()) throw new Error("Archive entry targets a symlink")
		await writeWithParents(outputPath, entry.getData())
	}
}

const BATCH_READ_CONCURRENCY = 32

async function readTextFiles(paths: readonly string[]): Promise<(TextFileRead | null)[]> {
	const results: (TextFileRead | null)[] = new Array(paths.length).fill(null)
	let next = 0
	const worker = async () => {
		while (next < paths.length) {
			const index = next++
			try {
				const allowedPath = assertAllowedPath(paths[index] ?? "")
				const [content, stats] = await Promise.all([
					fs.readFile(allowedPath, "utf8"),
					fs.stat(allowedPath),
				])
				results[index] = { content, modifiedAt: stats.mtimeMs, size: stats.size }
			} catch {
				results[index] = null
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(BATCH_READ_CONCURRENCY, paths.length) }, worker))
	return results
}

export const fsApi = {
	readFile: async (path) => await fs.readFile(assertAllowedPath(path), "utf8"),
	readTextFiles,
	readFileSnapshot: async (path) => {
		const allowedPath = assertAllowedPath(path)
		const [data, stats] = await Promise.all([fs.readFile(allowedPath), fs.stat(allowedPath)])
		return {
			content: data.toString("utf8"),
			hash: hashBytes(data),
			metadata: toFileMetadata(stats),
		}
	},
	readBinaryFile: async (path) => new Uint8Array(await fs.readFile(assertAllowedPath(path))),
	writeFileSnapshot: async (path, content): Promise<FileSnapshot> => {
		const allowedPath = assertAllowedPath(path)
		await writeWithParents(allowedPath, content)
		const metadata = await readFileMetadata(allowedPath).catch(() => {
			const now = Date.now()
			return { createdAt: now, modifiedAt: now }
		})
		return snapshotFromContent(content, metadata)
	},
	writeFile: async (path, content) => await writeWithParents(assertAllowedPath(path), content),
	atomicWriteFile: async (path, content) => {
		const allowedPath = assertAllowedPath(path)
		await fs.mkdir(dirname(allowedPath), { recursive: true })
		await writeFileAtomic(allowedPath, content, "utf8")
	},
	writeBinaryFile: async (path, data) => await writeWithParents(assertAllowedPath(path), data),
	copyFile: async (sourcePath, targetPath) => {
		const allowedSource = assertAllowedPath(sourcePath)
		const allowedTarget = assertAllowedPath(targetPath)
		await fs.mkdir(dirname(allowedTarget), { recursive: true })
		await fs.copyFile(allowedSource, allowedTarget, fsConstants.COPYFILE_EXCL)
	},
	deleteFile: async (path) => await fs.rm(assertAllowedPath(path), { recursive: true }),
	renameFile: async (oldPath, newPath) =>
		await renameFile(assertAllowedPath(oldPath), assertAllowedPath(newPath)),
	createDir: async (path) => {
		await fs.mkdir(assertAllowedPath(path), { recursive: true })
	},
	listDir: async (path) => await listDir(assertAllowedPath(path)),
	hashFile: async (path) => hashBytes(await fs.readFile(assertAllowedPath(path))),
	getFileMetadata: async (path) => await readFileMetadata(assertAllowedPath(path)),
	startWatching: async (path, options) => startWatching(assertAllowedPath(path), options),
	stopWatching: async (watcherId) => await stopWatching(watcherId),
	downloadFile: async (url, destPath) => {
		const allowedPath = assertAllowedPath(destPath)
		await writeWithParents(allowedPath, new Uint8Array(await (await fetchOk(url)).arrayBuffer()))
	},
	downloadText: async (url) => await (await fetchOk(url)).text(),
	downloadAndExtract: async (url, destDir) =>
		await downloadAndExtract(url, assertAllowedPath(destDir)),
} satisfies MainApi["fs"]
