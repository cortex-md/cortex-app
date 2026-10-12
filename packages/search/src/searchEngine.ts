import MiniSearch, { type Options } from "minisearch"
import { prepareSearchContent } from "./preprocessor"
import type { SearchDocument, SearchOptions, SearchResult } from "./types"

const DEFAULT_SEARCH_LIMIT = 100
const TITLE_SEARCH_LIMIT = 20

type SerializedSearchIndex = Parameters<typeof MiniSearch.loadJS>[0]

interface StoredSearchFields {
	title: string
	folder: string
	tags?: string[]
}

const SEARCH_INDEX_OPTIONS: Options<SearchDocument> = {
	fields: ["title", "content", "tags", "aliases"],
	storeFields: ["title", "folder", "tags"],
	searchOptions: {
		boost: { title: 3, aliases: 2, tags: 2, content: 1 },
		fuzzy: 0.2,
		prefix: true,
	},
}

function readSerializedDocumentIds(serialized: SerializedSearchIndex): string[] {
	return Object.values(serialized.documentIds).filter((id): id is string => typeof id === "string")
}

function toSearchResult(
	hit: { id: string; score: number; match: Record<string, string[]> },
	stored: StoredSearchFields,
): SearchResult {
	return {
		id: hit.id,
		title: stored.title,
		folder: stored.folder,
		score: hit.score,
		matchedFields: Object.values(hit.match).flat(),
		matchCount: 0,
		snippets: [],
	}
}

export class SearchEngine {
	private miniSearch: MiniSearch<SearchDocument>
	private documentIds = new Set<string>()

	constructor(serialized?: SerializedSearchIndex) {
		this.miniSearch = serialized
			? MiniSearch.loadJS<SearchDocument>(serialized, SEARCH_INDEX_OPTIONS)
			: new MiniSearch<SearchDocument>(SEARCH_INDEX_OPTIONS)
		if (serialized) this.documentIds = new Set(readSerializedDocumentIds(serialized))
	}

	addDocument(id: string, title: string, rawContent: string, folder: string, mtime: number): void {
		const { tags, aliases, content } = prepareSearchContent(rawContent)

		if (this.miniSearch.has(id)) {
			this.miniSearch.discard(id)
		}

		this.miniSearch.add({ id, title, content, tags, aliases, folder, mtime })
		this.documentIds.add(id)
	}

	removeDocument(id: string): void {
		if (this.miniSearch.has(id)) {
			this.miniSearch.discard(id)
		}
		this.documentIds.delete(id)
	}

	hasDocument(id: string): boolean {
		return this.documentIds.has(id) && this.miniSearch.has(id)
	}

	getDocumentIds(): string[] {
		return Array.from(this.documentIds)
	}

	pruneExcept(activeDocumentIds: Set<string>): void {
		for (const id of Array.from(this.documentIds)) {
			if (!activeDocumentIds.has(id)) this.removeDocument(id)
		}
	}

	search(query: string, options?: SearchOptions): SearchResult[] {
		if (!query.trim()) return []

		const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT
		const folders = [options?.folder, ...(options?.folders ?? [])].filter(
			(candidate): candidate is string => Boolean(candidate),
		)
		const tagFilters = options?.tags?.map((tag) => tag.toLowerCase()) ?? []
		const fileFilters = options?.files?.map((file) => file.toLowerCase()) ?? []
		const filter =
			folders.length > 0 || tagFilters.length > 0 || fileFilters.length > 0
				? (result: StoredSearchFields) => {
						if (folders.length > 0 && !folders.some((folder) => result.folder.startsWith(folder))) {
							return false
						}
						if (tagFilters.length > 0) {
							const documentTags = result.tags?.map((tag) => tag.toLowerCase()) ?? []
							const matchesTag = tagFilters.some((filterTag) =>
								documentTags.some((documentTag) => documentTag.includes(filterTag)),
							)
							if (!matchesTag) return false
						}
						if (fileFilters.length > 0) {
							const title = result.title?.toLowerCase() ?? ""
							if (!fileFilters.some((file) => title.includes(file))) return false
						}
						return true
					}
				: undefined

		return this.miniSearch
			.search(
				query,
				filter ? { filter: (result) => filter(result as unknown as StoredSearchFields) } : {},
			)
			.slice(0, limit)
			.map((hit) => toSearchResult(hit, hit as unknown as StoredSearchFields))
	}

	searchTitles(query: string): SearchResult[] {
		if (!query.trim()) return []

		return this.miniSearch
			.search(query, { fields: ["title", "aliases"], fuzzy: 0.2, prefix: true })
			.slice(0, TITLE_SEARCH_LIMIT)
			.map((hit) => toSearchResult(hit, hit as unknown as StoredSearchFields))
	}

	toJSON(): SerializedSearchIndex {
		return this.miniSearch.toJSON()
	}

	get documentCount(): number {
		return this.miniSearch.documentCount
	}
}
