import { projectRawNote } from "@cortex/properties"
import { getDatabaseIndexPath } from "./paths"
import { getDatabasesRuntime } from "./runtime"
import type {
	DatabaseFileEntry,
	DatabaseFileFingerprint,
	DatabaseIndex,
	DatabaseRow,
} from "./types"

const DATABASE_INDEX_VERSION = 1
const DATABASE_INDEX_READ_CONCURRENCY = 4

interface PersistedDatabaseIndex {
	version: typeof DATABASE_INDEX_VERSION
	files: Record<string, PersistedDatabaseFile>
	updatedAt: string
}

interface PersistedDatabaseFile {
	title: string
	folder: string
	mtime: number
	size: number
	createdAt: number
	updatedAt: number
	properties: DatabaseRow["properties"]
	frontmatterError: string | null
	fingerprint: DatabaseFileFingerprint
}

function isMissingFileError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	return /not found|no such file|os error 2|directory does not exist|file does not exist|path does not exist/i.test(
		message,
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function relativePath(filePath: string, vaultPath: string): string {
	return filePath.startsWith(`${vaultPath}/`) ? filePath.slice(vaultPath.length + 1) : filePath
}

function absolutePath(relativePath: string, vaultPath: string): string {
	return relativePath.startsWith("/") ? relativePath : `${vaultPath}/${relativePath}`
}

function titleFromPath(filePath: string): string {
	const name = filePath.split("/").pop() ?? filePath
	return name.toLocaleLowerCase().endsWith(".md") ? name.slice(0, -3) : name
}

function folderFromRelativePath(path: string): string {
	const parts = path.split("/")
	return parts.length > 1 ? parts.slice(0, -1).join("/") : ""
}

function getFileFingerprint(file: DatabaseFileEntry): DatabaseFileFingerprint {
	return {
		mtime: file.mtime ?? 0,
		size: file.size ?? 0,
	}
}

function hasSameFingerprint(
	left: DatabaseFileFingerprint | undefined,
	right: DatabaseFileFingerprint,
): boolean {
	return Boolean(left && left.mtime === right.mtime && left.size === right.size)
}

async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length)
	let nextIndex = 0
	const workerCount = Math.min(concurrency, items.length)
	const runNext = async (): Promise<void> => {
		const index = nextIndex
		nextIndex++
		if (index >= items.length) return
		results[index] = await worker(items[index])
		return runNext()
	}
	await Promise.all(Array.from({ length: workerCount }, () => runNext()))
	return results
}

function readPersistedIndex(raw: string): Map<string, PersistedDatabaseFile> {
	const parsed = JSON.parse(raw) as unknown
	if (!isRecord(parsed) || parsed.version !== DATABASE_INDEX_VERSION || !isRecord(parsed.files)) {
		return new Map()
	}
	const files = new Map<string, PersistedDatabaseFile>()
	for (const [path, file] of Object.entries(parsed.files)) {
		if (!isRecord(file) || !isRecord(file.fingerprint)) continue
		const fingerprint = file.fingerprint
		if (typeof fingerprint.mtime !== "number" || typeof fingerprint.size !== "number") continue
		const fileFingerprint: DatabaseFileFingerprint = {
			mtime: fingerprint.mtime,
			size: fingerprint.size,
		}
		files.set(path, {
			title: typeof file.title === "string" ? file.title : titleFromPath(path),
			folder: typeof file.folder === "string" ? file.folder : folderFromRelativePath(path),
			mtime: typeof file.mtime === "number" ? file.mtime : fileFingerprint.mtime,
			size: typeof file.size === "number" ? file.size : fileFingerprint.size,
			createdAt: typeof file.createdAt === "number" ? file.createdAt : 0,
			updatedAt: typeof file.updatedAt === "number" ? file.updatedAt : fileFingerprint.mtime,
			properties: isRecord(file.properties) ? file.properties : {},
			frontmatterError: typeof file.frontmatterError === "string" ? file.frontmatterError : null,
			fingerprint: fileFingerprint,
		})
	}
	return files
}

async function loadPersistedIndex(vaultPath: string): Promise<Map<string, PersistedDatabaseFile>> {
	try {
		return readPersistedIndex(
			await getDatabasesRuntime().files.readFile(getDatabaseIndexPath(vaultPath)),
		)
	} catch (error) {
		if (isMissingFileError(error)) return new Map()
		return new Map()
	}
}

function createRowFromPersisted(
	vaultPath: string,
	path: string,
	file: PersistedDatabaseFile,
): DatabaseRow {
	const filePath = absolutePath(path, vaultPath)
	return {
		id: path,
		filePath,
		relativePath: path,
		title: file.title,
		folder: file.folder,
		mtime: file.mtime,
		size: file.size,
		createdAt: file.createdAt,
		updatedAt: file.updatedAt,
		properties: file.properties,
		frontmatterError: file.frontmatterError,
		fingerprint: file.fingerprint,
	}
}

function createPersistedFromRow(row: DatabaseRow): PersistedDatabaseFile {
	return {
		title: row.title,
		folder: row.folder,
		mtime: row.mtime,
		size: row.size,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		properties: row.properties,
		frontmatterError: row.frontmatterError,
		fingerprint: row.fingerprint,
	}
}

export async function indexDatabaseFile(
	vaultPath: string,
	file: DatabaseFileEntry,
): Promise<DatabaseRow | null> {
	if (file.isDir || !file.path.toLocaleLowerCase().endsWith(".md")) return null
	const path = relativePath(file.path, vaultPath)
	const rawContent = await getDatabasesRuntime().notes.readNote(file.path)
	const projection = projectRawNote(rawContent)
	const fingerprint = getFileFingerprint(file)
	return {
		id: path,
		filePath: file.path,
		relativePath: path,
		title: titleFromPath(file.path),
		folder: folderFromRelativePath(path),
		mtime: file.mtime ?? 0,
		size: file.size ?? rawContent.length,
		createdAt: 0,
		updatedAt: file.mtime ?? 0,
		properties: projection.meta,
		frontmatterError: projection.frontmatterError,
		fingerprint,
	}
}

export async function buildDatabaseIndex(
	vaultPath: string,
	files: DatabaseFileEntry[],
): Promise<DatabaseIndex> {
	const persisted = await loadPersistedIndex(vaultPath)
	const rowsByPath: Record<string, DatabaseRow> = {}
	const fingerprints: Record<string, DatabaseFileFingerprint> = {}
	const nextPersistedFiles: Record<string, PersistedDatabaseFile> = {}
	const markdownFiles = files.filter(
		(file) => !file.isDir && file.path.toLocaleLowerCase().endsWith(".md"),
	)
	const changedFiles: DatabaseFileEntry[] = []
	for (const file of markdownFiles) {
		const path = relativePath(file.path, vaultPath)
		const fingerprint = getFileFingerprint(file)
		const cached = persisted.get(path)
		if (cached && hasSameFingerprint(cached.fingerprint, fingerprint)) {
			const row = createRowFromPersisted(vaultPath, path, cached)
			rowsByPath[path] = row
			fingerprints[path] = row.fingerprint
			nextPersistedFiles[path] = cached
			continue
		}
		changedFiles.push(file)
	}

	const indexedRows = await mapWithConcurrency(
		changedFiles,
		DATABASE_INDEX_READ_CONCURRENCY,
		async (file) => {
			try {
				return await indexDatabaseFile(vaultPath, file)
			} catch {
				return null
			}
		},
	)

	for (const row of indexedRows) {
		if (!row) continue
		rowsByPath[row.relativePath] = row
		fingerprints[row.relativePath] = row.fingerprint
		nextPersistedFiles[row.relativePath] = createPersistedFromRow(row)
	}

	const updatedAt = (getDatabasesRuntime().now?.() ?? new Date()).toISOString()
	const persistedIndex: PersistedDatabaseIndex = {
		version: DATABASE_INDEX_VERSION,
		files: nextPersistedFiles,
		updatedAt,
	}
	await getDatabasesRuntime()
		.files.writeFile(getDatabaseIndexPath(vaultPath), JSON.stringify(persistedIndex))
		.catch(() => {})

	return {
		version: DATABASE_INDEX_VERSION,
		vaultPath,
		rowsByPath,
		fingerprints,
		updatedAt,
	}
}

export function upsertDatabaseIndexRow(index: DatabaseIndex, row: DatabaseRow): DatabaseIndex {
	return {
		...index,
		rowsByPath: { ...index.rowsByPath, [row.relativePath]: row },
		fingerprints: { ...index.fingerprints, [row.relativePath]: row.fingerprint },
		updatedAt: (getDatabasesRuntime().now?.() ?? new Date()).toISOString(),
	}
}

export function removeDatabaseIndexPath(index: DatabaseIndex, filePath: string): DatabaseIndex {
	const path = relativePath(filePath, index.vaultPath)
	const rowsByPath = { ...index.rowsByPath }
	const fingerprints = { ...index.fingerprints }
	delete rowsByPath[path]
	delete fingerprints[path]
	return {
		...index,
		rowsByPath,
		fingerprints,
		updatedAt: (getDatabasesRuntime().now?.() ?? new Date()).toISOString(),
	}
}

export function renameDatabaseIndexPath(
	index: DatabaseIndex,
	oldPath: string,
	newPath: string,
): DatabaseIndex {
	const rowsByPath: Record<string, DatabaseRow> = {}
	const fingerprints: Record<string, DatabaseFileFingerprint> = {}
	const oldRelativePath = relativePath(oldPath, index.vaultPath)
	const newRelativePath = relativePath(newPath, index.vaultPath)
	for (const [path, row] of Object.entries(index.rowsByPath)) {
		const nextRelativePath =
			path === oldRelativePath
				? newRelativePath
				: path.startsWith(`${oldRelativePath}/`)
					? `${newRelativePath}${path.slice(oldRelativePath.length)}`
					: path
		const nextFilePath = absolutePath(nextRelativePath, index.vaultPath)
		const nextRow = {
			...row,
			id: nextRelativePath,
			filePath: nextFilePath,
			relativePath: nextRelativePath,
			title: titleFromPath(nextFilePath),
			folder: folderFromRelativePath(nextRelativePath),
		}
		rowsByPath[nextRelativePath] = nextRow
		fingerprints[nextRelativePath] = nextRow.fingerprint
	}
	return {
		...index,
		rowsByPath,
		fingerprints,
		updatedAt: (getDatabasesRuntime().now?.() ?? new Date()).toISOString(),
	}
}
