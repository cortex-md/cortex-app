import type { FileEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	getContentFingerprint,
	getFileEntryFingerprint,
	getNoteTitle,
	getParentPath,
	getVaultFilePath,
	isMarkdownPath,
	toVaultRelativePath,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { getLocalVaultState } from "@cortex/platform/vault-state"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type {
	NoteContentRequest,
	NoteMatchOptions,
	NoteMatchResult,
	SearchBackend,
	SearchIndexDocument,
	SearchIndexEntry,
} from "./backend"
import type { SearchMatches } from "./matches"
import { parseSearchQuery, toSearchRequest } from "./query"
import type { SearchOptions, SearchResult } from "./types"

const SERIALIZE_DEBOUNCE_MS = 5000
const VAULT_INDEX_READ_BATCH_SIZE = 200
const SNIPPET_RESULT_LIMIT = 100
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

function withMatches(result: SearchResult, matches: SearchMatches | null): SearchResult {
	if (!matches) return result
	return { ...result, matchCount: matches.count, snippets: matches.snippets }
}

async function resolveNoteContents<Result extends { status: string }>(
	vaultPath: string,
	ids: readonly string[],
	run: (notes: NoteContentRequest[]) => Promise<(Result | { status: "missing" })[]>,
): Promise<(Result | null)[]> {
	const first = await run(ids.map((id) => ({ id })))
	const resolved = first.map((result) => (result.status === "missing" ? null : (result as Result)))
	const missingIndexes = first.flatMap((result, index) =>
		result.status === "missing" ? [index] : [],
	)
	if (missingIndexes.length === 0) return resolved
	const reads = await getPlatform().fs.readTextFiles(
		missingIndexes.map((index) => getVaultFilePath(vaultPath, ids[index] ?? "")),
	)
	const readable = missingIndexes.flatMap((index, readIndex) => {
		const read = reads[readIndex]
		return read ? [{ index, raw: read.content }] : []
	})
	if (readable.length === 0) return resolved
	const second = await run(readable.map(({ index, raw }) => ({ id: ids[index] ?? "", raw })))
	readable.forEach(({ index }, readIndex) => {
		const result = second[readIndex]
		resolved[index] = result && result.status !== "missing" ? (result as Result) : null
	})
	return resolved
}

async function matchNoteContents(
	vaultPath: string,
	ids: readonly string[],
	query: string,
	options?: NoteMatchOptions,
): Promise<(NoteMatchResult | null)[]> {
	const backend = await getBackend()
	return resolveNoteContents(vaultPath, ids, (notes) => backend.matchNotes(query, notes, options))
}

function getMatches(result: NoteMatchResult | null | undefined): SearchMatches | null {
	return result?.status === "matched" ? result.matches : null
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
				const matches = await matchNoteContents(
					vaultPath,
					targets.map((result) => result.id),
					query,
				)
				if (generation !== searchGeneration) return
				set((state) => ({
					results: state.results.map((result, index) =>
						withMatches(result, getMatches(matches[index])),
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
					const matches = await matchNoteContents(
						vaultPath,
						results.map((result) => result.id),
						query,
					)
					return results.map((result, index) => withMatches(result, getMatches(matches[index])))
				},

				findPhrase: async (phrase, options) => {
					const vaultPath = indexedVaultPath
					const needle = phrase.trim().toLowerCase()
					if (!vaultPath || !needle) return []
					const candidates = (
						await (await getBackend()).search(phrase, { limit: PHRASE_CANDIDATE_LIMIT })
					).filter((result) => !options?.excludeIds?.has(result.id))
					const matches = await matchNoteContents(
						vaultPath,
						candidates.map((result) => result.id),
						phrase,
						{ requiredText: needle },
					)
					return candidates
						.flatMap((result, index) => {
							const resultMatches = getMatches(matches[index])
							return resultMatches ? [withMatches(result, resultMatches)] : []
						})
						.slice(0, options?.limit ?? PHRASE_CANDIDATE_LIMIT)
				},

				readNoteExcerpt: async (id) => {
					const vaultPath = indexedVaultPath
					if (!vaultPath) return null
					const backend = await getBackend()
					const [excerpt] = await resolveNoteContents(vaultPath, [id], (notes) =>
						backend.readNoteExcerpts(notes, EXCERPT_LENGTH),
					)
					return excerpt?.status === "read" ? excerpt.text : null
				},

				loadRecentQueries: async (vaultPath) => {
					historyVaultPath = vaultPath
					const { searchHistory } = await getLocalVaultState(vaultPath).read()
					if (historyVaultPath === vaultPath) {
						set({ recentQueries: searchHistory.slice(0, RECENT_QUERY_LIMIT) })
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
					void getLocalVaultState(historyVaultPath)
						.update((state) => ({ ...state, searchHistory: recentQueries }))
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
