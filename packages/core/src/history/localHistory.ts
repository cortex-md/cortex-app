import { getPlatform } from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import {
	getVaultFilePath,
	isMarkdownPath,
	joinPath,
	mapWithConcurrency,
	toVaultRelativePath,
	VAULT_CONFIG_DIR,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { getCurrentVaultPath } from "../stores/vaultRuntime"

export type LocalVersionReason = "edit" | "external" | "restore"

export interface LocalVersion {
	id: string
	timestamp: number
	reason: LocalVersionReason
	size: number
}

interface StoredVersion extends LocalVersion {
	hash: string
}

interface HistoryIndexFile {
	version: typeof INDEX_VERSION
	notes: Record<string, string>
}

interface VaultHistory {
	vaultPath: string
	root: string
	index: Map<string, string>
	versions: Map<string, StoredVersion[]>
	lastPruneAt: number
	pruneTimer: ReturnType<typeof setTimeout> | null
}

const INDEX_VERSION = 1
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const EDIT_INTERVAL_MS = 5 * MINUTE_MS
const KEEP_ALL_MS = DAY_MS
const KEEP_DAILY_MS = 30 * DAY_MS
const PRUNE_DELAY_MS = 30_000
const PRUNE_INTERVAL_MS = 30 * MINUTE_MS
const PRUNE_CONCURRENCY = 8
const NOTE_ID_LENGTH = 24
const CONTENT_HASH_LENGTH = 16
const VERSION_FILE_PATTERN = /^(\d+)-(edit|external|restore)-([0-9a-f]+)\.txt$/

export const LOCAL_HISTORY_SIZE_CAP_BYTES = 200 * 1024 * 1024

const encoder = new TextEncoder()
const lastEditCaptures = new Map<string, number>()
let queue: Promise<unknown> = Promise.resolve()
let activeHistory: Promise<VaultHistory> | null = null

function enqueue<T>(task: () => Promise<T>): Promise<T> {
	const next = queue.catch(() => undefined).then(task)
	queue = next
	return next
}

function isConfigPath(relativePath: string): boolean {
	return relativePath === VAULT_CONFIG_DIR || relativePath.startsWith(`${VAULT_CONFIG_DIR}/`)
}

function resolveRelativePath(filePath: string, vaultPath: string | null): string | null {
	if (!vaultPath || !isMarkdownPath(filePath)) return null
	const relativePath = toVaultRelativePath(filePath, vaultPath)
	return relativePath && !isConfigPath(relativePath) ? relativePath : null
}

function versionFilePath(history: VaultHistory, noteId: string, versionId: string): string {
	return joinPath(joinPath(history.root, noteId), versionId)
}

function parseVersion(name: string, size: number | undefined): StoredVersion | null {
	const match = VERSION_FILE_PATTERN.exec(name)
	if (!match) return null
	return {
		id: name,
		timestamp: Number(match[1]),
		reason: match[2] as LocalVersionReason,
		hash: match[3],
		size: size ?? 0,
	}
}

function toLocalVersion({ id, timestamp, reason, size }: StoredVersion): LocalVersion {
	return { id, timestamp, reason, size }
}

async function readIndex(root: string): Promise<Map<string, string>> {
	try {
		const parsed = JSON.parse(
			await getPlatform().fs.readFile(joinPath(root, "index.json")),
		) as Partial<HistoryIndexFile>
		if (parsed.version === INDEX_VERSION && parsed.notes && typeof parsed.notes === "object") {
			return new Map(Object.entries(parsed.notes))
		}
	} catch {}
	return new Map()
}

async function writeIndex(history: VaultHistory): Promise<void> {
	const file: HistoryIndexFile = {
		version: INDEX_VERSION,
		notes: Object.fromEntries(history.index),
	}
	await getPlatform().fs.atomicWriteFile(joinPath(history.root, "index.json"), JSON.stringify(file))
}

async function loadHistory(vaultPath: string): Promise<VaultHistory> {
	const current = activeHistory ? await activeHistory.catch(() => null) : null
	if (current?.vaultPath === vaultPath) return current
	if (current?.pruneTimer) clearTimeout(current.pruneTimer)
	const root = getVaultFilePath(vaultPath, VAULT_FILES.history)
	activeHistory = readIndex(root).then((index) => ({
		vaultPath,
		root,
		index,
		versions: new Map(),
		lastPruneAt: 0,
		pruneTimer: null,
	}))
	return activeHistory
}

async function ensureNoteId(history: VaultHistory, relativePath: string): Promise<string> {
	const existing = history.index.get(relativePath)
	if (existing) return existing
	const usedIds = new Set(history.index.values())
	let noteId = hashBytes(relativePath).slice(0, NOTE_ID_LENGTH)
	if (usedIds.has(noteId)) {
		noteId = hashBytes(`${relativePath}\n${Date.now()}`).slice(0, NOTE_ID_LENGTH)
	}
	history.index.set(relativePath, noteId)
	await writeIndex(history)
	return noteId
}

async function listStoredVersions(history: VaultHistory, noteId: string): Promise<StoredVersion[]> {
	try {
		const entries = await getPlatform().fs.listDir(joinPath(history.root, noteId))
		return entries
			.flatMap((entry) => {
				const version = entry.isDir ? null : parseVersion(entry.name, entry.size)
				return version ? [version] : []
			})
			.sort((left, right) => left.timestamp - right.timestamp)
	} catch {
		return []
	}
}

async function loadVersions(history: VaultHistory, noteId: string): Promise<StoredVersion[]> {
	const cached = history.versions.get(noteId)
	if (cached) return cached
	const versions = await listStoredVersions(history, noteId)
	history.versions.set(noteId, versions)
	return versions
}

function selectExpiredVersions<T extends { timestamp: number }>(
	versions: readonly T[],
	now: number,
): T[] {
	const keptDays = new Set<string>()
	const expired: T[] = []
	for (let index = versions.length - 1; index >= 0; index--) {
		const version = versions[index]
		const age = now - version.timestamp
		if (age <= KEEP_ALL_MS) continue
		if (age > KEEP_DAILY_MS) {
			expired.push(version)
			continue
		}
		const day = new Date(version.timestamp).toDateString()
		if (keptDays.has(day)) expired.push(version)
		else keptDays.add(day)
	}
	return expired
}

async function deleteVersions(
	history: VaultHistory,
	noteId: string,
	versions: readonly StoredVersion[],
): Promise<void> {
	if (versions.length === 0) return
	const fs = getPlatform().fs
	await Promise.all(
		versions.map((version) =>
			fs.deleteFile(versionFilePath(history, noteId, version.id)).catch(() => undefined),
		),
	)
	const removed = new Set(versions.map((version) => version.id))
	const cached = history.versions.get(noteId)
	if (cached) {
		history.versions.set(
			noteId,
			cached.filter((version) => !removed.has(version.id)),
		)
	}
}

async function pruneHistory(history: VaultHistory): Promise<void> {
	history.lastPruneAt = Date.now()
	const now = Date.now()
	let folders: string[]
	try {
		folders = (await getPlatform().fs.listDir(history.root)).flatMap((entry) =>
			entry.isDir ? [entry.name] : [],
		)
	} catch {
		return
	}
	const kept: { noteId: string; version: StoredVersion }[] = []
	const emptyFolders: string[] = []
	await mapWithConcurrency(folders, PRUNE_CONCURRENCY, async (noteId) => {
		const versions = history.versions.get(noteId) ?? (await listStoredVersions(history, noteId))
		const expired = selectExpiredVersions(versions, now)
		await deleteVersions(history, noteId, expired)
		const expiredIds = new Set(expired.map((version) => version.id))
		const remaining = versions.filter((version) => !expiredIds.has(version.id))
		if (remaining.length === 0) emptyFolders.push(noteId)
		for (const version of remaining) kept.push({ noteId, version })
	})

	let totalSize = kept.reduce((sum, item) => sum + item.version.size, 0)
	if (totalSize > LOCAL_HISTORY_SIZE_CAP_BYTES) {
		kept.sort((left, right) => left.version.timestamp - right.version.timestamp)
		const overflow = new Map<string, StoredVersion[]>()
		for (const item of kept) {
			if (totalSize <= LOCAL_HISTORY_SIZE_CAP_BYTES) break
			totalSize -= item.version.size
			overflow.set(item.noteId, [...(overflow.get(item.noteId) ?? []), item.version])
		}
		await mapWithConcurrency([...overflow], PRUNE_CONCURRENCY, ([noteId, versions]) =>
			deleteVersions(history, noteId, versions),
		)
	}

	const fs = getPlatform().fs
	await Promise.all(
		emptyFolders.map(async (noteId) => {
			history.versions.delete(noteId)
			await fs.deleteFile(joinPath(history.root, noteId)).catch(() => undefined)
		}),
	)
	const liveIds = new Set(folders.filter((noteId) => !emptyFolders.includes(noteId)))
	let indexChanged = false
	for (const [path, noteId] of history.index) {
		if (liveIds.has(noteId)) continue
		history.index.delete(path)
		indexChanged = true
	}
	if (indexChanged) await writeIndex(history)
}

function schedulePrune(history: VaultHistory): void {
	if (history.pruneTimer) return
	const delay = Math.max(PRUNE_DELAY_MS, history.lastPruneAt + PRUNE_INTERVAL_MS - Date.now())
	history.pruneTimer = setTimeout(() => {
		history.pruneTimer = null
		void enqueue(async () => {
			const current = activeHistory ? await activeHistory.catch(() => null) : null
			if (current === history) await pruneHistory(history)
		}).catch((error) => console.error("[Local history prune failed]", { error }))
	}, delay)
}

export function captureLocalVersion(
	filePath: string,
	content: string | (() => Promise<string>),
	reason: LocalVersionReason,
): Promise<void> {
	const vaultPath = getCurrentVaultPath()
	const relativePath = resolveRelativePath(filePath, vaultPath)
	if (!vaultPath || !relativePath) return Promise.resolve()
	const requestedAt = Date.now()
	if (reason === "edit") {
		const lastCapture = lastEditCaptures.get(filePath)
		if (lastCapture !== undefined && requestedAt - lastCapture < EDIT_INTERVAL_MS) {
			return Promise.resolve()
		}
		lastEditCaptures.set(filePath, requestedAt)
	}
	return enqueue(async () => {
		const text = typeof content === "string" ? content : await content()
		if (!text.trim()) return
		const history = await loadHistory(vaultPath)
		const noteId = await ensureNoteId(history, relativePath)
		const versions = await loadVersions(history, noteId)
		const latest = versions.at(-1)
		if (reason === "edit") {
			const recentEdit = versions.some(
				(version) =>
					version.reason === "edit" && requestedAt - version.timestamp < EDIT_INTERVAL_MS,
			)
			if (recentEdit) return
		}
		const hash = hashBytes(text).slice(0, CONTENT_HASH_LENGTH)
		if (latest?.hash === hash) return
		const timestamp = Math.max(Date.now(), (latest?.timestamp ?? 0) + 1)
		const id = `${timestamp}-${reason}-${hash}.txt`
		await getPlatform().fs.atomicWriteFile(versionFilePath(history, noteId, id), text)
		versions.push({ id, timestamp, reason, hash, size: encoder.encode(text).length })
		await deleteVersions(history, noteId, selectExpiredVersions(versions, Date.now()))
		schedulePrune(history)
	}).catch((error) => console.error("[Local history capture failed]", { path: filePath, error }))
}

export function listLocalVersions(filePath: string): Promise<LocalVersion[]> {
	const vaultPath = getCurrentVaultPath()
	const relativePath = resolveRelativePath(filePath, vaultPath)
	if (!vaultPath || !relativePath) return Promise.resolve([])
	return enqueue(async () => {
		const history = await loadHistory(vaultPath)
		const noteId = history.index.get(relativePath)
		if (!noteId) return []
		const versions = await loadVersions(history, noteId)
		return versions.map(toLocalVersion).reverse()
	})
}

export function readLocalVersion(filePath: string, versionId: string): Promise<string> {
	const vaultPath = getCurrentVaultPath()
	const relativePath = resolveRelativePath(filePath, vaultPath)
	if (!vaultPath || !relativePath || !VERSION_FILE_PATTERN.test(versionId)) {
		return Promise.reject(new Error("This version is not available."))
	}
	return enqueue(async () => {
		const history = await loadHistory(vaultPath)
		const noteId = history.index.get(relativePath)
		if (!noteId) throw new Error("This version is not available.")
		return getPlatform().fs.readFile(versionFilePath(history, noteId, versionId))
	})
}

function movePath(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath
	return path.startsWith(`${oldPath}/`) ? `${newPath}${path.slice(oldPath.length)}` : null
}

export function moveLocalHistory(
	vaultPath: string,
	oldPath: string,
	newPath: string,
): Promise<void> {
	const oldRelative = toVaultRelativePath(oldPath, vaultPath)
	const newRelative = toVaultRelativePath(newPath, vaultPath)
	if (!oldRelative || !newRelative || oldRelative === newRelative) return Promise.resolve()
	for (const [path, timestamp] of [...lastEditCaptures]) {
		const nextPath = movePath(path, oldPath, newPath)
		if (!nextPath) continue
		lastEditCaptures.delete(path)
		lastEditCaptures.set(nextPath, timestamp)
	}
	return enqueue(async () => {
		const history = await loadHistory(vaultPath)
		const moves: [string, string, string][] = []
		for (const [path, noteId] of history.index) {
			const nextPath = movePath(path, oldRelative, newRelative)
			if (nextPath) moves.push([path, nextPath, noteId])
		}
		if (moves.length === 0) return
		for (const [path] of moves) history.index.delete(path)
		for (const [, nextPath, noteId] of moves) history.index.set(nextPath, noteId)
		await writeIndex(history)
	}).catch((error) => console.error("[Local history move failed]", { oldPath, newPath, error }))
}
