import MiniSearch from "minisearch"
import { extractFrontmatter, stripMarkdown } from "./preprocessor"
import type { SearchDocument, SearchOptions, SearchResult } from "./types"

const SNIPPET_CONTEXT_CHARS = 60
const SEARCH_PREVIEW_CHARS = 8192
const DEFAULT_SEARCH_LIMIT = 100
const TITLE_SEARCH_LIMIT = 20
const regularExpressionSpecialCharacters = /[.*+?^${}()|[\]\\]/g

interface IndexedSearchDocument extends SearchDocument {
	preview: string
}

function escapeSearchTerm(term: string): string {
	return term.replace(regularExpressionSpecialCharacters, "\\$&")
}

function createSearchIndex(): MiniSearch<IndexedSearchDocument> {
	return new MiniSearch<IndexedSearchDocument>({
		fields: ["title", "content", "tags", "aliases"],
		storeFields: ["title", "folder", "preview", "tags"],
		searchOptions: {
			boost: { title: 3, aliases: 2, tags: 2, content: 1 },
			fuzzy: 0.2,
			prefix: true,
		},
	})
}

function readSerializedDocumentIds(json: string): string[] {
	const serialized = JSON.parse(json) as {
		documentIds?: unknown
		storedFields?: unknown
	}
	if (Array.isArray(serialized.documentIds)) {
		return serialized.documentIds.filter((id): id is string => typeof id === "string")
	}
	if (serialized.documentIds && typeof serialized.documentIds === "object") {
		return Object.values(serialized.documentIds).filter(
			(id): id is string => typeof id === "string",
		)
	}
	if (serialized.storedFields && typeof serialized.storedFields === "object") {
		return Object.keys(serialized.storedFields)
	}
	return []
}

function findBestSnippetIndex(content: string, query: string): number {
	const terms = query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.flatMap((term) => {
			const escapedTerm = escapeSearchTerm(term)
			return escapedTerm ? [escapedTerm] : []
		})
	if (terms.length === 0) return -1

	return new RegExp(terms.join("|")).exec(content.toLowerCase())?.index ?? -1
}

function buildSnippet(content: string, query: string): string {
	if (!query.trim()) return content.slice(0, SNIPPET_CONTEXT_CHARS * 2)

	const bestIndex = findBestSnippetIndex(content, query)
	if (bestIndex === -1) return content.slice(0, SNIPPET_CONTEXT_CHARS * 2)

	const start = Math.max(0, bestIndex - SNIPPET_CONTEXT_CHARS)
	const end = Math.min(content.length, bestIndex + SNIPPET_CONTEXT_CHARS)
	let snippet = content.slice(start, end).replace(/\n/g, " ")

	if (start > 0) snippet = `...${snippet}`
	if (end < content.length) snippet = `${snippet}...`

	return snippet
}

export class SearchEngine {
	private miniSearch: MiniSearch<IndexedSearchDocument>
	private documentIds = new Set<string>()

	constructor() {
		this.miniSearch = createSearchIndex()
	}

	clear(): void {
		this.miniSearch = createSearchIndex()
		this.documentIds.clear()
	}

	addDocument(id: string, title: string, rawContent: string, folder: string, mtime: number): void {
		const { tags, aliases, content: bodyContent } = extractFrontmatter(rawContent)
		const content = stripMarkdown(bodyContent)

		if (this.miniSearch.has(id)) {
			this.miniSearch.discard(id)
		}

		this.miniSearch.add({
			id,
			title,
			content,
			preview: content.slice(0, SEARCH_PREVIEW_CHARS),
			tags,
			aliases,
			folder,
			mtime,
		})
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

	pruneExcept(activeDocumentIds: Set<string>): void {
		for (const id of Array.from(this.documentIds)) {
			if (!activeDocumentIds.has(id)) this.removeDocument(id)
		}
	}

	search(query: string, options?: SearchOptions): SearchResult[] {
		if (!query.trim()) return []

		const searchOptions: Record<string, unknown> = {}
		const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT

		const hasTagFilter = options?.tags && options.tags.length > 0
		const hasFileFilter = options?.files && options.files.length > 0

		if (options?.folder || hasTagFilter || hasFileFilter) {
			searchOptions.filter = (result: IndexedSearchDocument) => {
				if (options?.folder && !result.folder.startsWith(options.folder)) return false
				if (hasTagFilter) {
					const docTags = (result as unknown as { tags?: string[] }).tags ?? []
					const matchesTag = options.tags!.some((filterTag) =>
						docTags.some((docTag) => docTag.toLowerCase().includes(filterTag.toLowerCase())),
					)
					if (!matchesTag) return false
				}
				if (hasFileFilter) {
					const title = (result as unknown as { title: string }).title?.toLowerCase() ?? ""
					const matchesFile = options.files!.some((f) => title.includes(f.toLowerCase()))
					if (!matchesFile) return false
				}
				return true
			}
		}

		const raw = this.miniSearch.search(query, searchOptions)
		return raw.slice(0, limit).map((hit) => {
			const stored = hit as unknown as {
				title: string
				folder: string
				preview?: string
				content?: string
			}
			return {
				id: hit.id,
				title: stored.title,
				folder: stored.folder,
				score: hit.score,
				matchedFields: Object.values(hit.match).flat(),
				snippet: buildSnippet(stored.preview ?? stored.content ?? "", query),
			}
		})
	}

	searchTitles(query: string): SearchResult[] {
		if (!query.trim()) return []

		const raw = this.miniSearch.search(query, {
			fields: ["title", "aliases"],
			fuzzy: 0.2,
			prefix: true,
		})

		return raw.slice(0, TITLE_SEARCH_LIMIT).map((hit) => ({
			id: hit.id,
			title: (hit as unknown as { title: string }).title,
			folder: (hit as unknown as { folder: string }).folder,
			score: hit.score,
			matchedFields: Object.values(hit.match).flat(),
			snippet: "",
		}))
	}

	serialize(): string {
		return JSON.stringify(this.miniSearch.toJSON())
	}

	deserialize(json: string): void {
		this.miniSearch = MiniSearch.loadJSON<IndexedSearchDocument>(json, {
			fields: ["title", "content", "tags", "aliases"],
			storeFields: ["title", "folder", "preview", "tags"],
			searchOptions: {
				boost: { title: 3, aliases: 2, tags: 2, content: 1 },
				fuzzy: 0.2,
				prefix: true,
			},
		})
		this.documentIds = new Set(readSerializedDocumentIds(json))
	}

	get documentCount(): number {
		return this.miniSearch.documentCount
	}
}
