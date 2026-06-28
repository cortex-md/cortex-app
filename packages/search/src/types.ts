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
	snippet: string
}

export interface SearchOptions {
	folder?: string
	tags?: string[]
	files?: string[]
	limit?: number
}
