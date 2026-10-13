import { getPlatform } from "@cortex/platform"
import { parseFrontmatter, type PropertyMap } from "@cortex/properties"
import { stripMarkdown } from "@cortex/search"
import { useEffect, useSyncExternalStore } from "react"

export interface NoteExcerpt {
	firstLine: string
	excerpt: string
	meta: PropertyMap
}

const EXCERPT_LENGTH = 140
const CACHE_LIMIT = 300

const cache = new Map<string, NoteExcerpt | null>()
const loading = new Set<string>()
const listeners = new Set<() => void>()

function cacheKey(filePath: string, modifiedAt: number | null | undefined): string {
	return `${filePath}@${modifiedAt ?? 0}`
}

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function remember(key: string, value: NoteExcerpt | null): void {
	cache.set(key, value)
	if (cache.size > CACHE_LIMIT) {
		const oldest = cache.keys().next().value
		if (oldest !== undefined) cache.delete(oldest)
	}
}

function toExcerpt(body: string): NoteExcerpt["excerpt"] {
	const text = stripMarkdown(body).replace(/\s+/g, " ").trim()
	return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text
}

function toFirstLine(body: string): string {
	const line = body
		.split("\n")
		.map((candidate) => stripMarkdown(candidate).trim())
		.find((candidate) => candidate.length > 0)
	return line ?? ""
}

async function loadExcerpt(filePath: string, key: string): Promise<void> {
	try {
		const raw = await getPlatform().fs.readFile(filePath)
		const { meta, body } = parseFrontmatter(raw)
		remember(key, { firstLine: toFirstLine(body), excerpt: toExcerpt(body), meta })
	} catch {
		remember(key, null)
	} finally {
		loading.delete(key)
		notify()
	}
}

export function requestNoteExcerpt(filePath: string, modifiedAt: number | null | undefined): void {
	const key = cacheKey(filePath, modifiedAt)
	if (cache.has(key) || loading.has(key)) return
	loading.add(key)
	void loadExcerpt(filePath, key)
}

export function useNoteExcerpt(
	filePath: string | null,
	modifiedAt: number | null | undefined,
): NoteExcerpt | null {
	const key = filePath ? cacheKey(filePath, modifiedAt) : null
	const excerpt = useSyncExternalStore(
		subscribe,
		() => (key ? (cache.get(key) ?? null) : null),
		() => null,
	)
	useEffect(() => {
		if (filePath) requestNoteExcerpt(filePath, modifiedAt)
	}, [filePath, modifiedAt])
	return excerpt
}
