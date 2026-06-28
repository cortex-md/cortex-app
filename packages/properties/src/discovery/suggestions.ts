import { parseFrontmatter } from "../frontmatter"
import { getPropertiesRuntime } from "../runtime"
import { getVaultSchema } from "../schemaPersistence"
import type { PropertyDefinition } from "../types"
import {
	createObservedPropertyDefinition,
	EXCLUDED_OBSERVED_PROPERTY_KEYS,
	isObservablePropertyValue,
} from "./observed"

interface IndexedProperty {
	definition: PropertyDefinition
	usage: number
}

interface SuggestionCacheEntry {
	generation: number
	builtGeneration: number
	indexed: IndexedProperty[] | null
	pending: Promise<void> | null
}

const SUGGESTION_INDEX_READ_CONCURRENCY = 4
const suggestionCache = new Map<string, SuggestionCacheEntry>()

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

function fuzzyScore(query: string, candidate: string): number {
	if (!query) return 1
	const normalizedQuery = query.toLocaleLowerCase()
	const normalizedCandidate = candidate.toLocaleLowerCase()
	if (normalizedCandidate === normalizedQuery) return 100
	if (normalizedCandidate.startsWith(normalizedQuery)) return 75
	if (normalizedCandidate.includes(normalizedQuery)) return 50
	let queryIndex = 0
	for (const character of normalizedCandidate) {
		if (character === normalizedQuery[queryIndex]) queryIndex++
		if (queryIndex === normalizedQuery.length) return 25
	}
	return 0
}

async function buildIndex(vaultPath: string): Promise<IndexedProperty[]> {
	const runtime = getPropertiesRuntime()
	const schema = await getVaultSchema(vaultPath)
	const indexed = new Map<string, IndexedProperty>(
		schema.properties.map((definition) => [
			definition.key.toLocaleLowerCase(),
			{ definition, usage: 0 },
		]),
	)
	const notePropertyEntries = await mapWithConcurrency(
		await runtime.notes.listMarkdownFiles(vaultPath),
		SUGGESTION_INDEX_READ_CONCURRENCY,
		async (filePath) => {
			try {
				return Object.entries(parseFrontmatter(await runtime.notes.readNote(filePath)).meta)
			} catch {
				return null
			}
		},
	)
	for (const entries of notePropertyEntries) {
		if (!entries) continue
		for (const [key, value] of entries) {
			const normalizedKey = key.toLocaleLowerCase()
			if (EXCLUDED_OBSERVED_PROPERTY_KEYS.has(normalizedKey)) continue
			const existing = indexed.get(normalizedKey)
			if (existing) {
				existing.usage++
				continue
			}
			if (!isObservablePropertyValue(value)) continue
			indexed.set(normalizedKey, {
				definition: createObservedPropertyDefinition(key, value),
				usage: 1,
			})
		}
	}
	return Array.from(indexed.values())
}

function getSuggestionCacheEntry(vaultPath: string): SuggestionCacheEntry {
	const existing = suggestionCache.get(vaultPath)
	if (existing) return existing
	const entry: SuggestionCacheEntry = {
		generation: 0,
		builtGeneration: -1,
		indexed: null,
		pending: null,
	}
	suggestionCache.set(vaultPath, entry)
	return entry
}

async function getSuggestionIndex(vaultPath: string): Promise<IndexedProperty[]> {
	const entry = getSuggestionCacheEntry(vaultPath)
	if (entry.indexed !== null && entry.builtGeneration === entry.generation) {
		return entry.indexed
	}
	if (!entry.pending) {
		const generation = entry.generation
		entry.pending = buildIndex(vaultPath)
			.then((indexed) => {
				if (entry.generation === generation) {
					entry.indexed = indexed
					entry.builtGeneration = generation
				}
			})
			.finally(() => {
				entry.pending = null
			})
	}
	await entry.pending
	return getSuggestionIndex(vaultPath)
}

export function invalidatePropertySuggestions(vaultPath?: string): void {
	if (vaultPath) {
		const entry = getSuggestionCacheEntry(vaultPath)
		entry.generation++
		entry.indexed = null
		return
	}
	for (const entry of suggestionCache.values()) {
		entry.generation++
		entry.indexed = null
	}
}

export async function suggestProperties(
	query: string,
	vaultPath: string,
): Promise<PropertyDefinition[]> {
	const normalizedQuery = query.trim()
	return (await getSuggestionIndex(vaultPath))
		.flatMap((entry) => {
			const score = Math.max(
				fuzzyScore(normalizedQuery, entry.definition.name),
				fuzzyScore(normalizedQuery, entry.definition.key),
			)
			return score > 0 ? [{ ...entry, score }] : []
		})
		.sort(
			(left, right) =>
				right.score - left.score ||
				right.usage - left.usage ||
				left.definition.name.localeCompare(right.definition.name),
		)
		.map((entry) => entry.definition)
}
