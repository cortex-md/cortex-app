import {
	type FileFingerprint,
	hasSameFingerprint,
	isPathOrDescendant,
} from "@cortex/platform/utils"
import { extractFrontmatterBody } from "@cortex/properties"
import { buildSearchMatches, type SearchMatches } from "./matches"
import { stripMarkdown } from "./preprocessor"
import { SearchEngine } from "./searchEngine"
import type { SearchOptions, SearchResult } from "./types"

const INDEX_VERSION = 2
const NOTE_CONTENT_CACHE_LIMIT = 200

export interface SearchIndexEntry {
	id: string
	fingerprint: FileFingerprint
}

export interface SearchIndexDocument extends SearchIndexEntry {
	title: string
	folder: string
	content: string
	mtime: number
}

export interface SearchIndexPlan {
	staleIds: string[]
	documentCount: number
}

export interface NoteContentRequest {
	id: string
	raw?: string
}

export interface NoteMatchOptions {
	requiredText?: string
}

export type NoteMatchResult =
	| { status: "missing" }
	| { status: "unmatched" }
	| { status: "matched"; matches: SearchMatches }

export type NoteExcerptResult = { status: "missing" } | { status: "read"; text: string }

export interface SearchBackend {
	load(persistedIndex: string | null): Promise<number>
	planIndex(entries: SearchIndexEntry[]): Promise<SearchIndexPlan>
	addDocuments(documents: SearchIndexDocument[]): Promise<number>
	removePaths(ids: string[]): Promise<number>
	search(query: string, options?: SearchOptions): Promise<SearchResult[]>
	searchTitles(query: string): Promise<SearchResult[]>
	matchNotes(
		query: string,
		notes: NoteContentRequest[],
		options?: NoteMatchOptions,
	): Promise<NoteMatchResult[]>
	readNoteExcerpts(notes: NoteContentRequest[], maxLength: number): Promise<NoteExcerptResult[]>
	serialize(): Promise<string>
	clear(): Promise<void>
}

interface PersistedSearchIndex {
	version: typeof INDEX_VERSION
	engine: ConstructorParameters<typeof SearchEngine>[0]
	documents: Record<string, FileFingerprint>
}

function isPersistedSearchIndex(value: unknown): value is PersistedSearchIndex {
	if (!value || typeof value !== "object") return false
	const candidate = value as Partial<PersistedSearchIndex>
	return (
		candidate.version === INDEX_VERSION &&
		Boolean(candidate.engine) &&
		Boolean(candidate.documents) &&
		typeof candidate.documents === "object"
	)
}

function readPersistedFingerprints(
	documents: PersistedSearchIndex["documents"],
): Map<string, FileFingerprint> {
	const fingerprints = new Map<string, FileFingerprint>()
	for (const [id, fingerprint] of Object.entries(documents)) {
		if (typeof fingerprint?.mtime === "number" && typeof fingerprint.size === "number") {
			fingerprints.set(id, { mtime: fingerprint.mtime, size: fingerprint.size })
		}
	}
	return fingerprints
}

function parsePersistedIndex(persistedIndex: string | null): {
	engine: SearchEngine
	fingerprints: Map<string, FileFingerprint>
} {
	if (persistedIndex) {
		try {
			const parsed = JSON.parse(persistedIndex) as unknown
			if (isPersistedSearchIndex(parsed)) {
				return {
					engine: new SearchEngine(parsed.engine),
					fingerprints: readPersistedFingerprints(parsed.documents),
				}
			}
		} catch {}
	}
	return { engine: new SearchEngine(), fingerprints: new Map() }
}

function toExcerpt(content: string, maxLength: number): string {
	const text = content.replace(/\s+/g, " ").trim()
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function createNoteContentCache() {
	const contents = new Map<string, string>()

	const remember = (id: string, content: string) => {
		contents.delete(id)
		contents.set(id, content)
		if (contents.size <= NOTE_CONTENT_CACHE_LIMIT) return
		const oldestId = contents.keys().next().value
		if (oldestId !== undefined) contents.delete(oldestId)
	}

	return {
		resolve: (note: NoteContentRequest): string | null => {
			if (note.raw !== undefined) {
				const content = stripMarkdown(extractFrontmatterBody(note.raw))
				remember(note.id, content)
				return content
			}
			const cached = contents.get(note.id)
			if (cached === undefined) return null
			remember(note.id, cached)
			return cached
		},
		forget: (ids: readonly string[]) => {
			for (const cachedId of Array.from(contents.keys())) {
				if (ids.some((id) => isPathOrDescendant(cachedId, id))) contents.delete(cachedId)
			}
		},
		clear: () => contents.clear(),
	}
}

export function createLocalSearchBackend(): SearchBackend {
	let engine = new SearchEngine()
	let fingerprints = new Map<string, FileFingerprint>()
	const noteContents = createNoteContentCache()

	const removeDocument = (id: string) => {
		engine.removeDocument(id)
		fingerprints.delete(id)
	}

	return {
		load: async (persistedIndex) => {
			const loaded = parsePersistedIndex(persistedIndex)
			engine = loaded.engine
			fingerprints = loaded.fingerprints
			noteContents.clear()
			return engine.documentCount
		},

		planIndex: async (entries) => {
			const activeIds = new Set<string>()
			const staleIds: string[] = []
			for (const { id, fingerprint } of entries) {
				activeIds.add(id)
				if (!engine.hasDocument(id) || !hasSameFingerprint(fingerprints.get(id), fingerprint)) {
					staleIds.push(id)
				}
			}
			engine.pruneExcept(activeIds)
			for (const id of Array.from(fingerprints.keys())) {
				if (!activeIds.has(id)) fingerprints.delete(id)
			}
			return { staleIds, documentCount: engine.documentCount }
		},

		addDocuments: async (documents) => {
			noteContents.forget(documents.map((document) => document.id))
			for (const document of documents) {
				engine.addDocument(
					document.id,
					document.title,
					document.content,
					document.folder,
					document.mtime,
				)
				fingerprints.set(document.id, document.fingerprint)
			}
			return engine.documentCount
		},

		removePaths: async (ids) => {
			noteContents.forget(ids)
			for (const documentId of engine.getDocumentIds()) {
				if (ids.some((id) => isPathOrDescendant(documentId, id))) removeDocument(documentId)
			}
			return engine.documentCount
		},

		search: async (query, options) => engine.search(query, options),

		searchTitles: async (query) => engine.searchTitles(query),

		matchNotes: async (query, notes, options) => {
			const requiredText = options?.requiredText?.trim().toLowerCase()
			return notes.map((note): NoteMatchResult => {
				const content = noteContents.resolve(note)
				if (content === null) return { status: "missing" }
				if (requiredText && !content.toLowerCase().includes(requiredText)) {
					return { status: "unmatched" }
				}
				return { status: "matched", matches: buildSearchMatches(content, query) }
			})
		},

		readNoteExcerpts: async (notes, maxLength) =>
			notes.map((note): NoteExcerptResult => {
				const content = noteContents.resolve(note)
				return content === null
					? { status: "missing" }
					: { status: "read", text: toExcerpt(content, maxLength) }
			}),

		serialize: async () => {
			const persisted: PersistedSearchIndex = {
				version: INDEX_VERSION,
				engine: engine.toJSON(),
				documents: Object.fromEntries(fingerprints),
			}
			return JSON.stringify(persisted)
		},

		clear: async () => {
			engine = new SearchEngine()
			fingerprints = new Map()
			noteContents.clear()
		},
	}
}
