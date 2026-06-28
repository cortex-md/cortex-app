import type { FileEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { SearchEngine } from "./searchEngine"
import type { SearchOptions, SearchResult } from "./types"

const INDEX_FILE = ".cortex/search-index.json"
const INDEX_VERSION = 1
const SERIALIZE_DEBOUNCE_MS = 5000
const VAULT_INDEX_READ_CONCURRENCY = 4

interface IndexedDocumentFingerprint {
	mtime: number
	size: number
}

interface PersistedSearchIndex {
	version: typeof INDEX_VERSION
	engine: unknown
	documents: Record<string, IndexedDocumentFingerprint>
}

interface SearchState {
	query: string
	results: SearchResult[]
	indexing: boolean
	documentCount: number

	setQuery: (query: string) => void
	search: (query: string, options?: SearchOptions) => void
	searchTitles: (query: string) => SearchResult[]
	indexVault: (vaultPath: string, files: FileEntry[]) => Promise<void>
	indexFile: (vaultPath: string, filePath: string) => Promise<void>
	removeFile: (vaultPath: string, filePath: string) => void
	cancelIndexing: () => void
	reset: () => void
}

let engine = new SearchEngine()
let indexedDocumentFingerprints = new Map<string, IndexedDocumentFingerprint>()
let serializeTimer: ReturnType<typeof setTimeout> | null = null
let indexVaultGeneration = 0

function scheduleSerialize(vaultPath: string) {
	if (serializeTimer) clearTimeout(serializeTimer)
	serializeTimer = setTimeout(async () => {
		try {
			const platform = getPlatform()
			const persisted: PersistedSearchIndex = {
				version: INDEX_VERSION,
				engine: JSON.parse(engine.serialize()) as unknown,
				documents: Object.fromEntries(indexedDocumentFingerprints),
			}
			await platform.fs.writeFile(`${vaultPath}/${INDEX_FILE}`, JSON.stringify(persisted))
		} catch (_e) {}
	}, SERIALIZE_DEBOUNCE_MS)
}

function relativeId(filePath: string, vaultPath: string): string {
	return filePath.startsWith(vaultPath) ? filePath.slice(vaultPath.length + 1) : filePath
}

function titleFromPath(filePath: string): string {
	const name = filePath.split("/").pop() ?? filePath
	return name.endsWith(".md") ? name.slice(0, -3) : name
}

function folderFromId(relativeId: string): string {
	const parts = relativeId.split("/")
	return parts.length > 1 ? parts.slice(0, -1).join("/") : ""
}

function getFileFingerprint(file: FileEntry): IndexedDocumentFingerprint {
	return {
		mtime: file.mtime ?? 0,
		size: file.size ?? 0,
	}
}

function hasSameFingerprint(
	left: IndexedDocumentFingerprint | undefined,
	right: IndexedDocumentFingerprint,
): boolean {
	return Boolean(left && left.mtime === right.mtime && left.size === right.size)
}

function isPersistedSearchIndex(value: unknown): value is PersistedSearchIndex {
	if (!value || typeof value !== "object") return false
	const candidate = value as Partial<PersistedSearchIndex>
	return candidate.version === INDEX_VERSION && candidate.engine !== undefined
}

function readPersistedFingerprints(
	documents: PersistedSearchIndex["documents"] | undefined,
): Map<string, IndexedDocumentFingerprint> {
	const fingerprints = new Map<string, IndexedDocumentFingerprint>()
	if (!documents || typeof documents !== "object") return fingerprints
	for (const [id, fingerprint] of Object.entries(documents)) {
		if (
			fingerprint &&
			typeof fingerprint === "object" &&
			typeof fingerprint.mtime === "number" &&
			typeof fingerprint.size === "number"
		) {
			fingerprints.set(id, { mtime: fingerprint.mtime, size: fingerprint.size })
		}
	}
	return fingerprints
}

async function loadPersistedSearchIndex(vaultPath: string): Promise<{
	engine: SearchEngine
	fingerprints: Map<string, IndexedDocumentFingerprint>
}> {
	const nextEngine = new SearchEngine()
	try {
		const indexJson = await getPlatform().fs.readFile(`${vaultPath}/${INDEX_FILE}`)
		const parsed = JSON.parse(indexJson) as unknown
		if (isPersistedSearchIndex(parsed)) {
			nextEngine.deserialize(JSON.stringify(parsed.engine))
			return {
				engine: nextEngine,
				fingerprints: readPersistedFingerprints(parsed.documents),
			}
		}
		nextEngine.deserialize(indexJson)
	} catch (_e) {}
	return { engine: nextEngine, fingerprints: new Map() }
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

export const useSearchStore = create<SearchState>()(
	devtools(
		(set, get) => ({
			query: "",
			results: [],
			indexing: false,
			documentCount: 0,

			setQuery: (query) => {
				set({ query })
				get().search(query)
			},

			search: (query, options) => {
				const results = engine.search(query, options)
				set({ results, query })
			},

			searchTitles: (query) => {
				return engine.searchTitles(query)
			},

			indexVault: async (vaultPath, files) => {
				const generation = ++indexVaultGeneration
				set({ indexing: true })
				const platform = getPlatform()
				const persisted = await loadPersistedSearchIndex(vaultPath)
				const nextEngine = persisted.engine
				const nextFingerprints = new Map(persisted.fingerprints)

				const mdFiles = files.filter((f) => !f.isDir && f.path.endsWith(".md"))
				const activeDocumentIds = new Set<string>()
				const changedFiles: FileEntry[] = []
				for (const file of mdFiles) {
					const id = relativeId(file.path, vaultPath)
					const fingerprint = getFileFingerprint(file)
					if (
						nextEngine.hasDocument(id) &&
						hasSameFingerprint(nextFingerprints.get(id), fingerprint)
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
						const id = relativeId(file.path, vaultPath)
						const fingerprint = getFileFingerprint(file)

						try {
							const content = await platform.fs.readFile(file.path)
							return {
								id,
								title: titleFromPath(file.path),
								content,
								folder: folderFromId(id),
								mtime: file.mtime ?? 0,
								fingerprint,
							}
						} catch {
							return { id, fingerprint, failed: true }
						}
					},
				)

				for (const document of indexedDocuments) {
					if (!document) continue
					if ("failed" in document) {
						nextEngine.removeDocument(document.id)
						nextFingerprints.delete(document.id)
						continue
					}
					nextEngine.addDocument(
						document.id,
						document.title,
						document.content,
						document.folder,
						document.mtime,
					)
					nextFingerprints.set(document.id, document.fingerprint)
					activeDocumentIds.add(document.id)
				}

				nextEngine.pruneExcept(activeDocumentIds)
				for (const id of Array.from(nextFingerprints.keys())) {
					if (!activeDocumentIds.has(id)) nextFingerprints.delete(id)
				}

				if (generation !== indexVaultGeneration) return
				engine = nextEngine
				indexedDocumentFingerprints = nextFingerprints
				set({ indexing: false, documentCount: engine.documentCount })
				scheduleSerialize(vaultPath)
			},

			indexFile: async (vaultPath, filePath) => {
				if (!filePath.endsWith(".md")) return
				const platform = getPlatform()
				const id = relativeId(filePath, vaultPath)

				try {
					const snapshot = await platform.fs.readFileSnapshot(filePath)
					engine.addDocument(id, titleFromPath(filePath), snapshot.content, folderFromId(id), 0)
					indexedDocumentFingerprints.set(id, {
						mtime: snapshot.metadata.modifiedAt,
						size: snapshot.content.length,
					})
					set({ documentCount: engine.documentCount })
					scheduleSerialize(vaultPath)
				} catch (_e) {
					engine.removeDocument(id)
					indexedDocumentFingerprints.delete(id)
					set({ documentCount: engine.documentCount })
				}
			},

			removeFile: (vaultPath, filePath) => {
				const id = relativeId(filePath, vaultPath)
				engine.removeDocument(id)
				indexedDocumentFingerprints.delete(id)
				set({ documentCount: engine.documentCount })
				scheduleSerialize(vaultPath)
			},

			cancelIndexing: () => {
				indexVaultGeneration++
				set({ indexing: false })
			},

			reset: () => {
				indexVaultGeneration++
				if (serializeTimer) clearTimeout(serializeTimer)
				serializeTimer = null
				engine = new SearchEngine()
				indexedDocumentFingerprints = new Map()
				set({ query: "", results: [], indexing: false, documentCount: 0 })
			},
		}),
		{ name: "searchStore" },
	),
)
