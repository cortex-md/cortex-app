import type { FileEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	getContentFingerprint,
	getFileEntryFingerprint,
	getNoteTitle,
	getParentPath,
	getVaultFilePath,
	isMarkdownPath,
	isPathOrDescendant,
	mapWithConcurrency,
	toVaultRelativePath,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { extractFrontmatterBody } from "@cortex/properties"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { SearchBackend, SearchIndexDocument, SearchIndexEntry } from "./backend"
import { buildSearchMatches } from "./matches"
import { stripMarkdown } from "./preprocessor"
import { parseSearchQuery, toSearchRequest } from "./query"
import type { SearchOptions, SearchResult } from "./types"

const SERIALIZE_DEBOUNCE_MS = 5000
const VAULT_INDEX_READ_BATCH_SIZE = 200
const SNIPPET_READ_CONCURRENCY = 8
const SNIPPET_RESULT_LIMIT = 100
const SNIPPET_CACHE_LIMIT = 200
const RECENT_QUERY_LIMIT = 10
const PHRASE_CANDIDATE_LIMIT = 60
const EXCERPT_LENGTH = 160

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

	setQuery: (query: string) => Promise<void>
	search: (query: string, options?: SearchOptions) => Promise<void>
	runQuery: (rawQuery: string) => Promise<void>
	searchTitles: (query: string) => Promise<SearchResult[]>
	findNotes: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
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
	removeFile: (vaultPath: string, filePath: string) => Promise<void>
	cancelIndexing: () => void
	reset: () => void
}

let configuredBackend: SearchBackend | null = null
let backendPromise: Promise<SearchBackend> | null = null

function getBackend(): Promise<SearchBackend> {
	if (configuredBackend) return Promise.resolve(configuredBackend)
	backendPromise ??= import("./backend").then((module) => {
		configuredBackend ??= module.createLocalSearchBackend()
		return configuredBackend
	})
	return backendPromise
}
let indexedVaultPath: string | null = null
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
		void getBackend()
			.then((backend) => backend.serialize())
			.then((serialized) =>
				getPlatform().fs.writeFile(
					getVaultFilePath(vaultPath, VAULT_FILES.searchIndex),
					serialized,
				),
			)
			.catch(() => {})
	}, SERIALIZE_DEBOUNCE_MS)
}

function getDocumentId(filePath: string, vaultPath: string): string {
	return toVaultRelativePath(filePath, vaultPath) ?? filePath
}

async function readPersistedSearchIndex(vaultPath: string): Promise<string | null> {
	try {
		return await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.searchIndex))
	} catch {
		return null
	}
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

function toIndexDocument(
	vaultPath: string,
	filePath: string,
	snapshot: IndexedFileSnapshot,
): SearchIndexDocument {
	const id = getDocumentId(filePath, vaultPath)
	return {
		id,
		title: getNoteTitle(filePath),
		folder: getParentPath(id),
		content: snapshot.content,
		mtime: snapshot.modifiedAt,
		fingerprint: getContentFingerprint(snapshot.content, snapshot.modifiedAt),
	}
}

export function setSearchBackend(nextBackend: SearchBackend): void {
	configuredBackend = nextBackend
	backendPromise = null
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

			async function runSearch(text: string, options: SearchOptions | undefined, query: string) {
				const generation = ++searchGeneration
				set({ query })
				if (!text.trim()) {
					set({ results: [] })
					return
				}
				const results = await (await getBackend()).search(text, options)
				if (generation !== searchGeneration) return
				set({ results })
				await loadSnippets(results, text, generation)
			}

			return {
				query: "",
				results: [],
				indexing: false,
				documentCount: 0,
				recentQueries: [],
				noteHighlight: null,

				setQuery: (query) => runSearch(query, undefined, query),

				search: (query, options) => runSearch(query, options, query),

				runQuery: (rawQuery) => {
					const request = toSearchRequest(parseSearchQuery(rawQuery))
					if (!request) return runSearch("", undefined, "")
					return runSearch(request.text, request.options, rawQuery)
				},

				searchTitles: async (query) => (await getBackend()).searchTitles(query),

				findNotes: async (query, options) => (await getBackend()).search(query, options),

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
					const candidates = (
						await (await getBackend()).search(phrase, { limit: PHRASE_CANDIDATE_LIMIT })
					).filter((result) => !options?.excludeIds?.has(result.id))
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
					const isCurrent = () => generation === indexVaultGeneration
					set({ indexing: true })
					const reusesLoadedIndex = indexedVaultPath === vaultPath
					if (!reusesLoadedIndex) {
						indexedVaultPath = null
						const persistedIndex = await readPersistedSearchIndex(vaultPath)
						if (!isCurrent()) return
						await (await getBackend()).load(persistedIndex)
					}

					const filesById = new Map<string, FileEntry>()
					const entries: SearchIndexEntry[] = []
					for (const file of files) {
						if (file.isDir || !isMarkdownPath(file.path)) continue
						const id = getDocumentId(file.path, vaultPath)
						filesById.set(id, file)
						entries.push({ id, fingerprint: getFileEntryFingerprint(file) })
					}
					if (!isCurrent()) return
					const plan = await (await getBackend()).planIndex(entries)
					let documentCount = plan.documentCount
					let pendingAdd: Promise<number> | null = null
					const unreadableIds: string[] = []
					for (let start = 0; start < plan.staleIds.length; start += VAULT_INDEX_READ_BATCH_SIZE) {
						const batch = plan.staleIds
							.slice(start, start + VAULT_INDEX_READ_BATCH_SIZE)
							.flatMap((id) => {
								const file = filesById.get(id)
								return file ? [{ id, file }] : []
							})
						const reads = await getPlatform().fs.readTextFiles(batch.map(({ file }) => file.path))
						if (pendingAdd) documentCount = await pendingAdd
						if (!isCurrent()) return
						const documents: SearchIndexDocument[] = []
						batch.forEach(({ id, file }, index) => {
							snippetContents.delete(id)
							const read = reads[index]
							if (!read) {
								unreadableIds.push(id)
								return
							}
							documents.push({
								id,
								title: getNoteTitle(file.path),
								folder: getParentPath(id),
								content: read.content,
								mtime: file.mtime ?? 0,
								fingerprint: getFileEntryFingerprint(file),
							})
						})
						pendingAdd = getBackend().then((backend) => backend.addDocuments(documents))
					}
					if (pendingAdd) documentCount = await pendingAdd
					if (!isCurrent()) return
					if (unreadableIds.length > 0)
						documentCount = await (await getBackend()).removePaths(unreadableIds)
					if (!isCurrent()) return

					indexedVaultPath = vaultPath
					set({ indexing: false, documentCount })
					if (plan.staleIds.length > 0 || !reusesLoadedIndex) scheduleSerialize(vaultPath)
				},

				indexFile: async (vaultPath, filePath, snapshot) => {
					if (!isMarkdownPath(filePath) || indexedVaultPath !== vaultPath) return
					try {
						const nextSnapshot = snapshot ?? (await readIndexedFileSnapshot(filePath))
						if (indexedVaultPath !== vaultPath) return
						const document = toIndexDocument(vaultPath, filePath, nextSnapshot)
						snippetContents.delete(document.id)
						const documentCount = await (await getBackend()).addDocuments([document])
						if (indexedVaultPath !== vaultPath) return
						set({ documentCount })
					} catch {
						await get().removeFile(vaultPath, filePath)
						return
					}
					scheduleSerialize(vaultPath)
				},

				removeFile: async (vaultPath, filePath) => {
					if (indexedVaultPath !== vaultPath) return
					const id = getDocumentId(filePath, vaultPath)
					forgetSnippetContents(id)
					scheduleSerialize(vaultPath)
					const documentCount = await (await getBackend()).removePaths([id])
					if (indexedVaultPath === vaultPath) set({ documentCount })
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
					void getBackend().then((backend) => backend.clear())
					indexedVaultPath = null
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
