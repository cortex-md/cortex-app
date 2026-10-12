import type { FileEntry, VaultMetadata } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	type FileFingerprint,
	getContentFingerprint,
	getFileEntryFingerprint,
	getParentPath,
	hasSameFingerprint,
	isMarkdownPath,
	mapWithConcurrency,
	normalizePath,
} from "@cortex/platform/utils"
import {
	createDatabaseRow,
	detectDatabaseNote,
	getDatabaseFolder,
	getDatabaseName,
	isDatabaseRowPath,
	isDatabaseViewNoteCandidate,
} from "@cortex/properties/database"
import { noteCache } from "../noteCache"
import { useDatabaseStore } from "../stores/databaseStore"
import { subscribeVaultFileChanges, useVaultStore } from "../stores/vaultStore"
import { isDatabaseConfigWritePending, withPendingDatabaseCells } from "./databaseWrites"

const READ_CONCURRENCY = 8
const REFRESH_DELAY_MS = 120

interface NoteContent {
	content: string
	fingerprint: FileFingerprint
}

type RetainListener = (folderPath: string) => void

const retainCounts = new Map<string, number>()
const retainListeners = new Set<RetainListener>()
const releaseListeners = new Set<RetainListener>()

export function retainDatabase(folderPath: string): () => void {
	const folder = normalizePath(folderPath)
	const count = retainCounts.get(folder) ?? 0
	retainCounts.set(folder, count + 1)
	if (count === 0) for (const listener of retainListeners) listener(folder)
	let released = false
	return () => {
		if (released) return
		released = true
		const next = (retainCounts.get(folder) ?? 1) - 1
		if (next > 0) {
			retainCounts.set(folder, next)
			return
		}
		retainCounts.delete(folder)
		for (const listener of releaseListeners) listener(folder)
	}
}

export function isDatabaseRetained(folderPath: string): boolean {
	return retainCounts.has(normalizePath(folderPath))
}

export function onDatabaseReleased(listener: RetainListener): () => void {
	releaseListeners.add(listener)
	return () => releaseListeners.delete(listener)
}

async function readNoteContent(path: string): Promise<NoteContent> {
	const entry = noteCache.getEntry(path)
	if (entry) {
		const modifiedAt = entry.metadata?.modifiedAt ?? entry.mtime
		return { content: entry.content, fingerprint: getContentFingerprint(entry.content, modifiedAt) }
	}
	const snapshot = await getPlatform().fs.readFileSnapshot(path)
	return {
		content: snapshot.content,
		fingerprint: getContentFingerprint(snapshot.content, snapshot.metadata.modifiedAt),
	}
}

function collectCandidates(files: readonly FileEntry[]): Map<string, FileEntry> {
	const folders = new Set(files.flatMap((file) => (file.isDir ? [file.path] : [])))
	const candidates = new Map<string, FileEntry>()
	for (const file of files) {
		if (file.isDir || !isDatabaseViewNoteCandidate(file.path)) continue
		if (folders.has(getParentPath(file.path))) candidates.set(file.path, file)
	}
	return candidates
}

function collectRowEntries(
	files: readonly FileEntry[],
	folderPath: string,
): Map<string, FileEntry> {
	const rows = new Map<string, FileEntry>()
	for (const file of files) {
		if (!file.isDir && isDatabaseRowPath(file.path, folderPath)) rows.set(file.path, file)
	}
	return rows
}

export function startDatabaseRuntime(): () => void {
	let vault: VaultMetadata | null = null
	let generation = 0
	let candidateFingerprints = new Map<string, FileFingerprint>()
	const rowFingerprints = new Map<string, Map<string, FileFingerprint>>()
	const rowVersions = new Map<string, number>()
	const rowLoads = new Map<string, boolean>()
	const pendingPaths = new Set<string>()
	let refreshTimer: ReturnType<typeof setTimeout> | null = null

	const store = () => useDatabaseStore.getState()

	const applyViewNote = (path: string, note: NoteContent, fingerprint = note.fingerprint) => {
		candidateFingerprints.set(path, fingerprint)
		const folderPath = getDatabaseFolder(path)
		const detection = detectDatabaseNote(note.content)
		if (!detection.isDatabase) {
			store().removeDatabase(folderPath)
			return
		}
		const current = store().databases[folderPath]
		const keepConfig = current !== undefined && isDatabaseConfigWritePending(folderPath)
		store().setDatabase({
			folderPath,
			viewNotePath: path,
			name: getDatabaseName(folderPath),
			config: keepConfig ? current.config : detection.config,
			configError: keepConfig ? current.configError : detection.error,
			description: detection.body.trim(),
		})
		if (retainCounts.has(folderPath) && !store().rowsByFolder[folderPath]) {
			void loadRows(folderPath)
		}
	}

	const applyRow = (folderPath: string, path: string, note: NoteContent) => {
		const fingerprints = rowFingerprints.get(folderPath) ?? new Map<string, FileFingerprint>()
		fingerprints.set(path, note.fingerprint)
		rowFingerprints.set(folderPath, fingerprints)
		rowVersions.set(path, (rowVersions.get(path) ?? 0) + 1)
		store().upsertRows(folderPath, [
			withPendingDatabaseCells(createDatabaseRow(path, note.content, note.fingerprint)),
		])
	}

	const readViewNotes = async (entries: readonly FileEntry[], currentGeneration: number) => {
		await mapWithConcurrency(entries, READ_CONCURRENCY, async (entry) => {
			try {
				const note = await readNoteContent(entry.path)
				if (currentGeneration !== generation) return
				const fingerprint = getFileEntryFingerprint(entry)
				applyViewNote(entry.path, note, fingerprint.mtime ? fingerprint : note.fingerprint)
			} catch {
				if (currentGeneration !== generation) return
				candidateFingerprints.delete(entry.path)
				store().removeDatabase(getDatabaseFolder(entry.path))
			}
		})
	}

	const loadRowsOnce = async (folderPath: string, files: readonly FileEntry[]) => {
		const currentGeneration = generation
		const entries = collectRowEntries(files, folderPath)
		const fingerprints = rowFingerprints.get(folderPath) ?? new Map<string, FileFingerprint>()
		rowFingerprints.set(folderPath, fingerprints)
		const removed = [...fingerprints.keys()].filter((path) => !entries.has(path))
		for (const path of removed) fingerprints.delete(path)
		store().removeRows(folderPath, removed)
		const known = store().rowsByFolder[folderPath]?.rows ?? {}
		const changed = [...entries.values()].filter(
			(entry) =>
				!known[entry.path] ||
				!hasSameFingerprint(fingerprints.get(entry.path), getFileEntryFingerprint(entry)),
		)
		if (!store().rowsByFolder[folderPath]) store().setRowsStatus(folderPath, "loading")
		const rows = await mapWithConcurrency(changed, READ_CONCURRENCY, async (entry) => {
			const version = rowVersions.get(entry.path) ?? 0
			try {
				const note = await readNoteContent(entry.path)
				if ((rowVersions.get(entry.path) ?? 0) !== version) return null
				const fingerprint = getFileEntryFingerprint(entry)
				fingerprints.set(entry.path, fingerprint.mtime ? fingerprint : note.fingerprint)
				return withPendingDatabaseCells(
					createDatabaseRow(entry.path, note.content, note.fingerprint),
				)
			} catch {
				return null
			}
		})
		if (currentGeneration !== generation) return
		store().upsertRows(
			folderPath,
			rows.filter((row) => row !== null),
		)
		store().setRowsStatus(folderPath, "ready")
	}

	const loadRows = async (folderPath: string) => {
		if (rowLoads.has(folderPath)) {
			rowLoads.set(folderPath, true)
			return
		}
		rowLoads.set(folderPath, false)
		try {
			do {
				rowLoads.set(folderPath, false)
				const state = useVaultStore.getState()
				if (!vault || state.vault !== vault) return
				await loadRowsOnce(folderPath, state.files)
			} while (rowLoads.get(folderPath))
		} finally {
			rowLoads.delete(folderPath)
		}
	}

	const syncFiles = () => {
		const state = useVaultStore.getState()
		if (!vault || state.vault !== vault) return
		const candidates = collectCandidates(state.files)
		const changed: FileEntry[] = []
		for (const [path, entry] of candidates) {
			if (!hasSameFingerprint(candidateFingerprints.get(path), getFileEntryFingerprint(entry))) {
				changed.push(entry)
			}
		}
		for (const path of candidateFingerprints.keys()) {
			if (candidates.has(path)) continue
			candidateFingerprints.delete(path)
			store().removeDatabase(getDatabaseFolder(path))
		}
		const currentGeneration = generation
		void readViewNotes(changed, currentGeneration).then(() => {
			if (currentGeneration === generation && !store().registryReady) store().setRegistryReady(true)
		})
		for (const folder of retainCounts.keys()) void loadRows(folder)
	}

	const flushPending = async () => {
		refreshTimer = null
		const paths = [...pendingPaths]
		pendingPaths.clear()
		const currentGeneration = generation
		await mapWithConcurrency(paths, READ_CONCURRENCY, async (path) => {
			try {
				const note = await readNoteContent(path)
				if (currentGeneration !== generation) return
				handleContent(path, note)
			} catch {}
		})
	}

	const queuePath = (path: string) => {
		pendingPaths.add(path)
		if (!refreshTimer) refreshTimer = setTimeout(() => void flushPending(), REFRESH_DELAY_MS)
	}

	const tracksRows = (folder: string) => retainCounts.has(folder) || rowFingerprints.has(folder)

	const handleContent = (path: string, note: NoteContent) => {
		if (candidateFingerprints.has(path)) applyViewNote(path, note)
		const folder = getParentPath(path)
		if (tracksRows(folder) && isDatabaseRowPath(path, folder)) applyRow(folder, path, note)
	}

	const isRelevant = (path: string) =>
		isMarkdownPath(path) && (candidateFingerprints.has(path) || tracksRows(getParentPath(path)))

	const reset = () => {
		generation++
		candidateFingerprints = new Map()
		rowFingerprints.clear()
		rowVersions.clear()
		pendingPaths.clear()
		if (refreshTimer) clearTimeout(refreshTimer)
		refreshTimer = null
		store().reset()
	}

	const handleVaultState = () => {
		const state = useVaultStore.getState()
		if (state.vault !== vault) {
			reset()
			vault = state.vault
		}
		if (vault) syncFiles()
	}

	const handleRetain: RetainListener = (folder) => void loadRows(folder)

	retainListeners.add(handleRetain)
	handleVaultState()
	const unsubscribeVault = useVaultStore.subscribe((state, previous) => {
		if (state.vault !== previous.vault || state.files !== previous.files) handleVaultState()
	})
	const unsubscribeChanges = subscribeVaultFileChanges((changes) => {
		for (const change of changes) {
			if (change.kind !== "modified" || !isRelevant(change.path)) continue
			if (!noteCache.getEntry(change.path)) queuePath(change.path)
		}
	})
	const unsubscribeDisk = noteCache.onDiskContentChange((entry) => {
		if (!isRelevant(entry.filePath)) return
		pendingPaths.delete(entry.filePath)
		const modifiedAt = entry.metadata?.modifiedAt ?? entry.mtime
		handleContent(entry.filePath, {
			content: entry.content,
			fingerprint: getContentFingerprint(entry.content, modifiedAt),
		})
	})

	return () => {
		retainListeners.delete(handleRetain)
		unsubscribeVault()
		unsubscribeChanges()
		unsubscribeDisk()
		reset()
		vault = null
	}
}

export function applyDatabaseRowContent(path: string, content: string): void {
	const folder = getParentPath(path)
	if (!retainCounts.has(folder) || !isDatabaseRowPath(path, folder)) return
	useDatabaseStore
		.getState()
		.upsertRows(folder, [
			createDatabaseRow(path, content, getContentFingerprint(content, Date.now())),
		])
}
