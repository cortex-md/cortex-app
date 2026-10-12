import {
	type FileFingerprint,
	hasSameFingerprint,
	isPathOrDescendant,
} from "@cortex/platform/utils"
import { SearchEngine } from "./searchEngine"
import type { SearchOptions, SearchResult } from "./types"

const INDEX_VERSION = 2

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

export interface SearchBackend {
	load(persistedIndex: string | null): Promise<number>
	planIndex(entries: SearchIndexEntry[]): Promise<SearchIndexPlan>
	addDocuments(documents: SearchIndexDocument[]): Promise<number>
	removePaths(ids: string[]): Promise<number>
	search(query: string, options?: SearchOptions): Promise<SearchResult[]>
	searchTitles(query: string): Promise<SearchResult[]>
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

export function createLocalSearchBackend(): SearchBackend {
	let engine = new SearchEngine()
	let fingerprints = new Map<string, FileFingerprint>()

	const removeDocument = (id: string) => {
		engine.removeDocument(id)
		fingerprints.delete(id)
	}

	return {
		load: async (persistedIndex) => {
			const loaded = parsePersistedIndex(persistedIndex)
			engine = loaded.engine
			fingerprints = loaded.fingerprints
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
			for (const documentId of engine.getDocumentIds()) {
				if (ids.some((id) => isPathOrDescendant(documentId, id))) removeDocument(documentId)
			}
			return engine.documentCount
		},

		search: async (query, options) => engine.search(query, options),

		searchTitles: async (query) => engine.searchTitles(query),

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
		},
	}
}
