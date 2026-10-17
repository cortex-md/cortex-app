import { type FileEntry, getPlatform } from "@cortex/platform"
import {
	type FileFingerprint,
	getFileEntryFingerprint,
	getVaultFilePath,
	hasSameFingerprint,
	isMarkdownPath,
	isPathOrDescendant,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { extractFrontmatterBody, parseFrontmatter } from "@cortex/properties"
import { extractWikiLinks, type WikiLink } from "@cortex/search"
import { parseTasks, type Task } from "@cortex/tasks"
import { useLinksStore } from "../stores/linksStore"
import { useTagsStore } from "../stores/tagsStore"
import { useTasksStore } from "../stores/tasksStore"
import { createDebouncedWriter } from "../utils/createDebouncedWriter"
import { collectNoteTags } from "../utils/frontmatter"
import { readTextFilesInBatches } from "../utils/readTextFilesInBatches"

export interface NoteMetadata {
	tags: string[]
	links: WikiLink[]
	tasks: Task[]
	properties: Record<string, unknown> | null
}

export interface IndexedNoteMetadata extends FileFingerprint, NoteMetadata {}

export interface NoteMetadataUpdate {
	path: string
	content: string
	fingerprint?: FileFingerprint
}

export interface NotePropertiesSnapshot {
	version: number
	notes: Iterable<Record<string, unknown>>
}

export const NOTES_INDEX_VERSION = 1
const NOTES_INDEX_SERIALIZE_DELAY_MS = 5000

interface PersistedNotesIndex {
	version: typeof NOTES_INDEX_VERSION
	files: Record<string, IndexedNoteMetadata>
}

const indexWriter = createDebouncedWriter(NOTES_INDEX_SERIALIZE_DELAY_MS)
let generation = 0
let version = 0
let indexedVaultPath: string | null = null
let indexedFiles = new Map<string, IndexedNoteMetadata>()
let pendingBuild: { vaultPath: string; promise: Promise<void> } | null = null

export function extractNoteMetadata(filePath: string, content: string): NoteMetadata {
	let meta: Record<string, unknown> | null = null
	let body: string
	try {
		const parsed = parseFrontmatter(content)
		meta = Object.keys(parsed.meta).length > 0 ? parsed.meta : null
		body = parsed.body
	} catch {
		body = extractFrontmatterBody(content)
	}
	return {
		tags: collectNoteTags(meta, body),
		links: extractWikiLinks(body),
		tasks: parseTasks(filePath, content),
		properties: meta,
	}
}

function isFingerprinted(value: unknown): value is FileFingerprint {
	const candidate = value as Partial<FileFingerprint> | null
	return typeof candidate?.mtime === "number" && typeof candidate.size === "number"
}

function readPersistedEntry(value: unknown): IndexedNoteMetadata | null {
	if (!isFingerprinted(value)) return null
	const entry = value as Partial<IndexedNoteMetadata>
	if (!Array.isArray(entry.tags) || !Array.isArray(entry.links) || !Array.isArray(entry.tasks)) {
		return null
	}
	return {
		mtime: entry.mtime as number,
		size: entry.size as number,
		tags: entry.tags.filter((tag): tag is string => typeof tag === "string"),
		links: entry.links,
		tasks: entry.tasks,
		properties:
			entry.properties && typeof entry.properties === "object" && !Array.isArray(entry.properties)
				? entry.properties
				: null,
	}
}

export function parsePersistedNotesIndex(raw: string): Map<string, IndexedNoteMetadata> {
	const files = new Map<string, IndexedNoteMetadata>()
	let parsed: Partial<PersistedNotesIndex>
	try {
		parsed = JSON.parse(raw) as Partial<PersistedNotesIndex>
	} catch {
		return files
	}
	if (
		parsed?.version !== NOTES_INDEX_VERSION ||
		!parsed.files ||
		typeof parsed.files !== "object"
	) {
		return files
	}
	for (const [filePath, value] of Object.entries(parsed.files)) {
		const entry = readPersistedEntry(value)
		if (entry) files.set(filePath, entry)
	}
	return files
}

async function loadPersistedIndex(vaultPath: string): Promise<Map<string, IndexedNoteMetadata>> {
	try {
		return parsePersistedNotesIndex(
			await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.notesIndex)),
		)
	} catch {
		return new Map()
	}
}

function scheduleSerialize(vaultPath: string): void {
	indexWriter.schedule(() => {
		if (indexedVaultPath !== vaultPath) return
		const persisted: PersistedNotesIndex = {
			version: NOTES_INDEX_VERSION,
			files: Object.fromEntries(indexedFiles),
		}
		const platform = getPlatform()
		const path = getVaultFilePath(vaultPath, VAULT_FILES.notesIndex)
		void platform.fs
			.createDir(getVaultFilePath(vaultPath, VAULT_FILES.cache))
			.catch(() => undefined)
			.then(() => platform.fs.atomicWriteFile(path, JSON.stringify(persisted)))
			.catch(() => undefined)
	})
}

function sameList<T>(left: readonly T[], right: readonly T[]): boolean {
	if (left === right) return true
	if (left.length !== right.length) return false
	return JSON.stringify(left) === JSON.stringify(right)
}

function publishAll(vaultPath: string, inboxTasks: Task[]): void {
	const tagIndex: Record<string, string[]> = {}
	const fileTags: Record<string, string[]> = {}
	const outgoing: Record<string, WikiLink[]> = {}
	const tasksByPath: Record<string, Task[]> = {}
	for (const [filePath, entry] of indexedFiles) {
		fileTags[filePath] = entry.tags
		for (const tag of entry.tags) {
			const paths = tagIndex[tag]
			if (paths) paths.push(filePath)
			else tagIndex[tag] = [filePath]
		}
		if (entry.links.length > 0) outgoing[filePath] = entry.links
		if (entry.tasks.length > 0) tasksByPath[filePath] = entry.tasks
	}
	const inboxPath = getVaultFilePath(vaultPath, VAULT_FILES.taskInbox)
	if (inboxTasks.length > 0) tasksByPath[inboxPath] = inboxTasks
	useTagsStore.setState({ tagIndex, fileTags })
	useLinksStore.setState({ outgoing })
	useTasksStore.setState({ tasksByPath, inboxPath })
}

interface PendingPatch {
	tags: Map<string, { previous: readonly string[]; next: string[] | null }>
	links: Map<string, WikiLink[] | null>
	tasks: Map<string, Task[] | null>
}

function createPatch(): PendingPatch {
	return { tags: new Map(), links: new Map(), tasks: new Map() }
}

function patchEntry(
	patch: PendingPatch,
	filePath: string,
	previous: NoteMetadata | undefined,
	next: NoteMetadata | null,
): void {
	const previousTags = previous?.tags ?? []
	if (!next || !sameList(previousTags, next.tags)) {
		const existing = patch.tags.get(filePath)
		patch.tags.set(filePath, {
			previous: existing?.previous ?? previousTags,
			next: next ? next.tags : null,
		})
	}
	if (!next || !sameList(previous?.links ?? [], next.links)) {
		patch.links.set(filePath, next && next.links.length > 0 ? next.links : null)
	}
	if (!next || !sameList(previous?.tasks ?? [], next.tasks)) {
		patch.tasks.set(filePath, next && next.tasks.length > 0 ? next.tasks : null)
	}
}

function commitPatch(patch: PendingPatch): void {
	if (patch.tags.size > 0) {
		const { tagIndex, fileTags } = useTagsStore.getState()
		const nextIndex = { ...tagIndex }
		const nextFileTags = { ...fileTags }
		for (const [filePath, { previous, next }] of patch.tags) {
			for (const tag of previous) {
				const paths = nextIndex[tag]?.filter((path) => path !== filePath)
				if (paths && paths.length > 0) nextIndex[tag] = paths
				else delete nextIndex[tag]
			}
			if (next) {
				for (const tag of next) nextIndex[tag] = [...(nextIndex[tag] ?? []), filePath]
				nextFileTags[filePath] = next
			} else {
				delete nextFileTags[filePath]
			}
		}
		useTagsStore.setState({ tagIndex: nextIndex, fileTags: nextFileTags })
	}
	if (patch.links.size > 0) {
		const outgoing = { ...useLinksStore.getState().outgoing }
		for (const [filePath, links] of patch.links) {
			if (links) outgoing[filePath] = links
			else delete outgoing[filePath]
		}
		useLinksStore.setState({ outgoing })
	}
	if (patch.tasks.size > 0) {
		const tasksByPath = { ...useTasksStore.getState().tasksByPath }
		for (const [filePath, tasks] of patch.tasks) {
			if (tasks) tasksByPath[filePath] = tasks
			else delete tasksByPath[filePath]
		}
		useTasksStore.setState({ tasksByPath })
	}
}

async function readInboxTasks(inboxPath: string): Promise<Task[]> {
	try {
		return parseTasks(inboxPath, await getPlatform().fs.readFile(inboxPath))
	} catch {
		return []
	}
}

async function runBuild(vaultPath: string, files: readonly FileEntry[]): Promise<void> {
	const buildGeneration = ++generation
	const cachedFiles =
		indexedVaultPath === vaultPath ? indexedFiles : await loadPersistedIndex(vaultPath)
	const nextFiles = new Map<string, IndexedNoteMetadata>()
	const changedFiles: FileEntry[] = []
	for (const file of files) {
		if (file.isDir || !isMarkdownPath(file.path)) continue
		const cached = cachedFiles.get(file.path)
		if (cached && hasSameFingerprint(cached, getFileEntryFingerprint(file))) {
			nextFiles.set(file.path, cached)
		} else {
			changedFiles.push(file)
		}
	}
	const inboxPath = getVaultFilePath(vaultPath, VAULT_FILES.taskInbox)
	const [reads, inboxTasks] = await Promise.all([
		readTextFilesInBatches(changedFiles.map((file) => file.path)),
		readInboxTasks(inboxPath),
	])
	if (buildGeneration !== generation) return
	changedFiles.forEach((file, index) => {
		const read = reads[index]
		if (!read) return
		nextFiles.set(file.path, {
			...getFileEntryFingerprint(file),
			...extractNoteMetadata(file.path, read.content),
		})
	})
	indexedVaultPath = vaultPath
	indexedFiles = nextFiles
	version++
	publishAll(vaultPath, inboxTasks)
	if (changedFiles.length > 0 || cachedFiles.size !== nextFiles.size) scheduleSerialize(vaultPath)
}

export const noteMetadataIndex = {
	build(vaultPath: string, files: readonly FileEntry[]): Promise<void> {
		if (pendingBuild?.vaultPath === vaultPath) return pendingBuild.promise
		const promise = runBuild(vaultPath, files).finally(() => {
			if (pendingBuild?.promise === promise) pendingBuild = null
		})
		pendingBuild = { vaultPath, promise }
		return promise
	},

	updateMany(updates: readonly NoteMetadataUpdate[]): void {
		const patch = createPatch()
		const inboxPath = useTasksStore.getState().inboxPath
		let changed = false
		for (const { path, content, fingerprint } of updates) {
			if (path === inboxPath) {
				patch.tasks.set(path, parseTasks(path, content))
				continue
			}
			let metadata: NoteMetadata
			try {
				metadata = extractNoteMetadata(path, content)
			} catch {
				continue
			}
			const previous = indexedFiles.get(path)
			patchEntry(patch, path, previous, metadata)
			if (!indexedVaultPath) continue
			indexedFiles.set(path, {
				...(fingerprint ?? { mtime: previous?.mtime ?? 0, size: previous?.size ?? 0 }),
				...metadata,
			})
			changed = true
		}
		for (const [path, tasks] of patch.tasks) {
			if (tasks && tasks.length === 0) patch.tasks.set(path, null)
		}
		commitPatch(patch)
		if (changed && indexedVaultPath) {
			version++
			scheduleSerialize(indexedVaultPath)
		}
	},

	update(path: string, content: string, fingerprint?: FileFingerprint): void {
		noteMetadataIndex.updateMany([{ path, content, fingerprint }])
	},

	remove(path: string): void {
		const removed = indexedFiles.has(path)
			? [path]
			: [...indexedFiles.keys()].filter((candidate) => isPathOrDescendant(candidate, path))
		const fileTags = useTagsStore.getState().fileTags
		const patch = createPatch()
		for (const removedPath of removed) {
			const previous = indexedFiles.get(removedPath)
			patchEntry(
				patch,
				removedPath,
				previous ?? {
					tags: fileTags[removedPath] ?? [],
					links: [],
					tasks: [],
					properties: null,
				},
				null,
			)
			indexedFiles.delete(removedPath)
		}
		if (removed.length === 0) return
		commitPatch(patch)
		version++
		if (indexedVaultPath) scheduleSerialize(indexedVaultPath)
	},

	getNoteProperties(vaultPath: string): NotePropertiesSnapshot | null {
		if (indexedVaultPath !== vaultPath) return null
		return {
			version,
			notes: (function* () {
				for (const entry of indexedFiles.values()) if (entry.properties) yield entry.properties
			})(),
		}
	},

	getEntry(path: string): IndexedNoteMetadata | undefined {
		return indexedFiles.get(path)
	},

	isBuilt(vaultPath: string): boolean {
		return indexedVaultPath === vaultPath
	},

	cancel(): void {
		generation++
		pendingBuild = null
	},

	reset(): void {
		generation++
		version++
		indexWriter.cancel()
		indexedVaultPath = null
		indexedFiles = new Map()
		pendingBuild = null
		useTagsStore.setState({ tagIndex: {}, fileTags: {}, activeTagFilter: null })
		useLinksStore.setState({ outgoing: {} })
		useTasksStore.setState({ tasksByPath: {}, inboxPath: null })
	},
}
