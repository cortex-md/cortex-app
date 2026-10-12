import type { SearchSnippet } from "./matches"

export interface SearchDocument {
	id: string
	title: string
	content: string
	tags: string[]
	aliases: string[]
	folder: string
	mtime: number
}

export interface SearchResult {
	id: string
	title: string
	folder: string
	score: number
	matchedFields: string[]
	matchCount: number
	snippets: SearchSnippet[]
}

export interface SearchOptions {
	folder?: string
	folders?: string[]
	tags?: string[]
	files?: string[]
	limit?: number
}
