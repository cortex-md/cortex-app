import type { FileEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	type FileFingerprint,
	getContentFingerprint,
	getFileEntryFingerprint,
	getNoteTitle,
	getParentPath,
	getVaultFilePath,
	hasSameFingerprint,
	isMarkdownPath,
	isPathOrDescendant,
	mapWithConcurrency,
	toVaultRelativePath,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { extractFrontmatterBody } from "@cortex/properties"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { buildSearchMatches } from "./matches"
import { stripMarkdown } from "./preprocessor"
import { parseSearchQuery, toSearchRequest } from "./query"
import { SearchEngine } from "./searchEngine"
import type { SearchOptions, SearchResult } from "./types"

const INDEX_VERSION = 2
const SERIALIZE_DEBOUNCE_MS = 5000
const VAULT_INDEX_READ_CONCURRENCY = 4
const SNIPPET_READ_CONCURRENCY = 8
const SNIPPET_RESULT_LIMIT = 100
const SNIPPET_CACHE_LIMIT = 200
const RECENT_QUERY_LIMIT = 10
const PHRASE_CANDIDATE_LIMIT = 60
const EXCERPT_LENGTH = 160

interface PersistedSearchIndex {
	version: typeof INDEX_VERSION
	engine: ConstructorParameters<typeof SearchEngine>[0]
	documents: Record<string, FileFingerprint>
}

export interface IndexedFileSnapshot {
	content: string
	modifiedAt: number
}

export interface NoteSearchHighlight {
	filePath: string
	query: string
	matchIndex: number
}

interface SearchState {
	query: string
	results: SearchResult[]
	indexing: boolean
	documentCount: number
	recentQueries: string[]
	noteHighlight: NoteSearchHighlight | null

	setQuery: (query: string) => void
	search: (query: string, options?: SearchOptions) => void
	runQuery: (rawQuery: string) => void
	searchTitles: (query: string) => SearchResult[]
	findNotes: (query: string, options?: SearchOptions) => SearchResult[]
	loadMatches: (results: SearchResult[], query: string) => Promise<SearchResult[]>
	findPhrase: (
		phrase: string,
		options?: { limit?: number; excludeIds?: ReadonlySet<string> },
	) => Promise<SearchResult[]>
	readNoteExcerpt: (id: string) => Promise<string | null>
	loadRecentQueries: (vaultPath: string) => Promise<void>
	addRecentQuery: (query: string) => void
	setNoteHighlight: (highlight: NoteSearchHighlight | null) => void
	indexVault: (vaultPath: string, files: FileEntry[]) => Promise<void>
	indexFile: (vaultPath: string, filePath: string, snapshot?: IndexedFileSnapshot) => Promise<void>
	removeFile: (vaultPath: string, filePath: string) => void
	cancelIndexing: () => void
	reset: () => void
}

let engine = new SearchEngine()
let indexedVaultPath: string | null = null
let indexedDocumentFingerprints = new Map<string, FileFingerprint>()
let serializeTimer: ReturnType<typeof setTimeout> | null = null
let indexVaultGeneration = 0
let searchGeneration = 0
let historyVaultPath: string | null = null
const snippetContents = new Map<string, string>()

function withMatches(result: SearchResult, content: string | null, query: string): SearchResult {
	if (!content) return result
	const matches = buildSearchMatches(content, query)
	return { ...result, matchCount: matches.count, snippets: matches.snippets }
}

function toExcerpt(content: string): string {
	const text = content.replace(/\s+/g, " ").trim()
	return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text
}

function scheduleSerialize(vaultPath: string) {
	if (serializeTimer) clearTimeout(serializeTimer)
	serializeTimer = setTimeout(() => {
		serializeTimer = null
		if (indexedVaultPath !== vaultPath) return
		const persisted: PersistedSearchIndex = {
			version: INDEX_VERSION,
			engine: engine.toJSON(),
			documents: Object.fromEntries(indexedDocumentFingerprints),
		}
		void getPlatform()
			.fs.writeFile(getVaultFilePath(vaultPath, VAULT_FILES.searchIndex), JSON.stringify(persisted))
			.catch(() => {})
	}, SERIALIZE_DEBOUNCE_MS)
}

function getDocumentId(filePath: string, vaultPath: string): string {
	return toVaultRelativePath(filePath, vaultPath) ?? filePath
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

async function loadPersistedSearchIndex(vaultPath: string): Promise<{
	engine: SearchEngine
	fingerprints: Map<string, FileFingerprint>
}> {
	try {
		const raw = await getPlatform().fs.readFile(
			getVaultFilePath(vaultPath, VAULT_FILES.searchIndex),
		)
		const parsed = JSON.parse(raw) as unknown
		if (isPersistedSearchIndex(parsed)) {
			return {
				engine: new SearchEngine(parsed.engine),
				fingerprints: readPersistedFingerprints(parsed.documents),
			}
		}
	} catch {}
	return { engine: new SearchEngine(), fingerprints: new Map() }
}

function rememberSnippetContent(id: string, content: string): void {
	snippetContents.delete(id)
	snippetContents.set(id, content)
	if (snippetContents.size <= SNIPPET_CACHE_LIMIT) return
	const oldestId = snippetContents.keys().next().value
	if (oldestId !== undefined) snippetContents.delete(oldestId)
}

function forgetSnippetContents(id: string): void {
	for (const cachedId of Array.from(snippetContents.keys())) {
		if (isPathOrDescendant(cachedId, id)) snippetContents.delete(cachedId)
	}
}

async function readSnippetContent(vaultPath: string, id: string): Promise<string | null> {
	const cached = snippetContents.get(id)
	if (cached !== undefined) return cached
	try {
		const raw = await getPlatform().fs.readFile(getVaultFilePath(vaultPath, id))
		const content = stripMarkdown(extractFrontmatterBody(raw))
		rememberSnippetContent(id, content)
		return content
	} catch {
		return null
	}
}

async function readIndexedFileSnapshot(filePath: string): Promise<IndexedFileSnapshot> {
	const snapshot = await getPlatform().fs.readFileSnapshot(filePath)
	return { content: snapshot.content, modifiedAt: snapshot.metadata.modifiedAt }
}

function applyIndexedDocument(
	vaultPath: string,
	filePath: string,
	snapshot: IndexedFileSnapshot,
): void {
	const id = getDocumentId(filePath, vaultPath)
	engine.addDocument(
		id,
		getNoteTitle(filePath),
		snapshot.content,
		getParentPath(id),
		snapshot.modifiedAt,
	)
	indexedDocumentFingerprints.set(id, getContentFingerprint(snapshot.content, snapshot.modifiedAt))
	snippetContents.delete(id)
}

export const useSearchStore = create<SearchState>()(
	devtools(
		(set, get) => {
			async function loadSnippets(results: SearchResult[], query: string, generation: number) {
				const vaultPath = indexedVaultPath
				if (!vaultPath || results.length === 0) return
				const targets = results.slice(0, SNIPPET_RESULT_LIMIT)
				const contents = await mapWithConcurrency(targets, SNIPPET_READ_CONCURRENCY, (result) =>
					readSnippetContent(vaultPath, result.id),
				)
				if (generation !== searchGeneration) return
				set((state) => ({
					results: state.results.map((result, index) =>
						withMatches(result, contents[index] ?? null, query),
					),
				}))
			}

			return {
				query: "",
				results: [],
				indexing: false,
				documentCount: 0,
				recentQueries: [],
				noteHighlight: null,

				setQuery: (query) => {
					set({ query })
					get().search(query)
				},

				search: (query, options) => {
					const generation = ++searchGeneration
					const results = engine.search(query, options)
					set({ results, query })
					void loadSnippets(results, query, generation)
				},

				runQuery: (rawQuery) => {
					const request = toSearchRequest(parseSearchQuery(rawQuery))
					if (!request) {
						get().setQuery("")
						return
					}
					get().search(request.text, request.options)
					set({ query: rawQuery })
				},

				searchTitles: (query) => {
					return engine.searchTitles(query)
				},

				findNotes: (query, options) => engine.search(query, options),

				loadMatches: async (results, query) => {
					const vaultPath = indexedVaultPath
					if (!vaultPath || results.length === 0) return results
					const contents = await mapWithConcurrency(results, SNIPPET_READ_CONCURRENCY, (result) =>
						readSnippetContent(vaultPath, result.id),
					)
					return results.map((result, index) => withMatches(result, contents[index] ?? null, query))
				},

				findPhrase: async (phrase, options) => {
					const vaultPath = indexedVaultPath
					const needle = phrase.trim().toLowerCase()
					if (!vaultPath || !needle) return []
					const candidates = engine
						.search(phrase, { limit: PHRASE_CANDIDATE_LIMIT })
						.filter((result) => !options?.excludeIds?.has(result.id))
					const contents = await mapWithConcurrency(
						candidates,
						SNIPPET_READ_CONCURRENCY,
						(result) => readSnippetContent(vaultPath, result.id),
					)
					return candidates
						.flatMap((result, index) => {
							const content = contents[index]
							if (!content?.toLowerCase().includes(needle)) return []
							return [withMatches(result, content, phrase)]
						})
						.slice(0, options?.limit ?? PHRASE_CANDIDATE_LIMIT)
				},

				readNoteExcerpt: async (id) => {
					const vaultPath = indexedVaultPath
					if (!vaultPath) return null
					const content = await readSnippetContent(vaultPath, id)
					return content === null ? null : toExcerpt(content)
				},

				loadRecentQueries: async (vaultPath) => {
					historyVaultPath = vaultPath
					try {
						const raw = await getPlatform().fs.readFile(
							getVaultFilePath(vaultPath, VAULT_FILES.searchHistory),
						)
						const parsed = JSON.parse(raw) as unknown
						const recentQueries = Array.isArray(parsed)
							? parsed.filter((query): query is string => typeof query === "string")
							: []
						if (historyVaultPath === vaultPath) {
							set({ recentQueries: recentQueries.slice(0, RECENT_QUERY_LIMIT) })
						}
					} catch {
						if (historyVaultPath === vaultPath) set({ recentQueries: [] })
					}
				},

				addRecentQuery: (query) => {
					const normalized = query.trim()
					if (!normalized) return
					const recentQueries = [
						normalized,
						...get().recentQueries.filter((candidate) => candidate !== normalized),
					].slice(0, RECENT_QUERY_LIMIT)
					set({ recentQueries })
					if (!historyVaultPath) return
					void getPlatform()
						.fs.writeFile(
							getVaultFilePath(historyVaultPath, VAULT_FILES.searchHistory),
							JSON.stringify(recentQueries),
						)
						.catch(() => {})
				},

				setNoteHighlight: (highlight) => {
					set({ noteHighlight: highlight })
				},

				indexVault: async (vaultPath, files) => {
					const generation = ++indexVaultGeneration
					set({ indexing: true })
					const platform = getPlatform()
					const reusesLoadedIndex = indexedVaultPath === vaultPath
					const loaded = reusesLoadedIndex
						? { engine, fingerprints: indexedDocumentFingerprints }
						: await loadPersistedSearchIndex(vaultPath)

					const activeDocumentIds = new Set<string>()
					const changedFiles: FileEntry[] = []
					for (const file of files) {
						if (file.isDir || !isMarkdownPath(file.path)) continue
						const id = getDocumentId(file.path, vaultPath)
						if (
							loaded.engine.hasDocument(id) &&
							hasSameFingerprint(loaded.fingerprints.get(id), getFileEntryFingerprint(file))
						) {
							activeDocumentIds.add(id)
							continue
						}
						changedFiles.push(file)
					}

					const indexedDocuments = await mapWithConcurrency(
						changedFiles,
						VAULT_INDEX_READ_CONCURRENCY,
						async (file) => {
							try {
								return { file, content: await platform.fs.readFile(file.path) }
							} catch {
								return { file, content: null }
							}
						},
					)

					if (generation !== indexVaultGeneration) return
					engine = loaded.engine
					indexedDocumentFingerprints = loaded.fingerprints
					indexedVaultPath = vaultPath
					for (const { file, content } of indexedDocuments) {
						const id = getDocumentId(file.path, vaultPath)
						if (content === null) continue
						engine.addDocument(
							id,
							getNoteTitle(file.path),
							content,
							getParentPath(id),
							file.mtime ?? 0,
						)
						indexedDocumentFingerprints.set(id, getFileEntryFingerprint(file))
						snippetContents.delete(id)
						activeDocumentIds.add(id)
					}
					engine.pruneExcept(activeDocumentIds)
					for (const id of Array.from(indexedDocumentFingerprints.keys())) {
						if (!activeDocumentIds.has(id)) indexedDocumentFingerprints.delete(id)
					}

					set({ indexing: false, documentCount: engine.documentCount })
					if (changedFiles.length > 0 || !reusesLoadedIndex) scheduleSerialize(vaultPath)
				},

				indexFile: async (vaultPath, filePath, snapshot) => {
					if (!isMarkdownPath(filePath) || indexedVaultPath !== vaultPath) return
					try {
						const nextSnapshot = snapshot ?? (await readIndexedFileSnapshot(filePath))
						if (indexedVaultPath !== vaultPath) return
						applyIndexedDocument(vaultPath, filePath, nextSnapshot)
					} catch {
						get().removeFile(vaultPath, filePath)
						return
					}
					set({ documentCount: engine.documentCount })
					scheduleSerialize(vaultPath)
				},

				removeFile: (vaultPath, filePath) => {
					if (indexedVaultPath !== vaultPath) return
					const id = getDocumentId(filePath, vaultPath)
					for (const documentId of engine.getDocumentIds()) {
						if (!isPathOrDescendant(documentId, id)) continue
						engine.removeDocument(documentId)
						indexedDocumentFingerprints.delete(documentId)
					}
					forgetSnippetContents(id)
					set({ documentCount: engine.documentCount })
					scheduleSerialize(vaultPath)
				},

				cancelIndexing: () => {
					indexVaultGeneration++
					set({ indexing: false })
				},

				reset: () => {
					indexVaultGeneration++
					searchGeneration++
					if (serializeTimer) clearTimeout(serializeTimer)
					serializeTimer = null
					engine = new SearchEngine()
					indexedVaultPath = null
					indexedDocumentFingerprints = new Map()
					snippetContents.clear()
					historyVaultPath = null
					set({
						query: "",
						results: [],
						indexing: false,
						documentCount: 0,
						recentQueries: [],
						noteHighlight: null,
					})
				},
			}
		},
		{ name: "searchStore" },
	),
)
