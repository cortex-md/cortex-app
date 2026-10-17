import { parseFrontmatter } from "../frontmatter"
import { getPropertiesRuntime } from "../runtime"
import { getVaultSchema } from "../schemaPersistence"
import type { PropertyDefinition, PropertyMap } from "../types"
import {
	createObservedPropertyDefinition,
	EXCLUDED_OBSERVED_PROPERTY_KEYS,
	isObservablePropertyValue,
} from "./observed"

interface IndexedProperty {
	definition: PropertyDefinition
	usage: number
	values: Map<string, number>
}

export interface PropertyValueUsage {
	notes: number
	values: Record<string, number>
}

function countValues(target: Map<string, number>, value: unknown): void {
	for (const item of Array.isArray(value) ? value : [value]) {
		if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") continue
		const key = String(item)
		target.set(key, (target.get(key) ?? 0) + 1)
	}
}

interface SuggestionCacheEntry {
	generation: number
	schemaGeneration: number
	built: { generation: number; schemaGeneration: number; indexVersion: number | null } | null
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

async function readNotePropertyMaps(vaultPath: string): Promise<Iterable<PropertyMap | null>> {
	const runtime = getPropertiesRuntime()
	const snapshot = runtime.noteIndex?.getNoteProperties(vaultPath)
	if (snapshot) return snapshot.notes
	return mapWithConcurrency(
		await runtime.notes.listMarkdownFiles(vaultPath),
		SUGGESTION_INDEX_READ_CONCURRENCY,
		async (filePath) => {
			try {
				return parseFrontmatter(await runtime.notes.readNote(filePath)).meta
			} catch {
				return null
			}
		},
	)
}

async function buildIndex(vaultPath: string): Promise<IndexedProperty[]> {
	const schema = await getVaultSchema(vaultPath)
	const indexed = new Map<string, IndexedProperty>(
		schema.properties.map((definition) => [
			definition.key.toLocaleLowerCase(),
			{ definition, usage: 0, values: new Map<string, number>() },
		]),
	)
	for (const meta of await readNotePropertyMaps(vaultPath)) {
		if (!meta) continue
		for (const [key, value] of Object.entries(meta)) {
			const normalizedKey = key.toLocaleLowerCase()
			if (EXCLUDED_OBSERVED_PROPERTY_KEYS.has(normalizedKey)) continue
			const existing = indexed.get(normalizedKey)
			if (existing) {
				existing.usage++
				countValues(existing.values, value)
				continue
			}
			if (!isObservablePropertyValue(value)) continue
			const values = new Map<string, number>()
			countValues(values, value)
			indexed.set(normalizedKey, {
				definition: createObservedPropertyDefinition(key, value),
				usage: 1,
				values,
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
		schemaGeneration: 0,
		built: null,
		indexed: null,
		pending: null,
	}
	suggestionCache.set(vaultPath, entry)
	return entry
}

function getIndexVersion(vaultPath: string): number | null {
	return getPropertiesRuntime().noteIndex?.getNoteProperties(vaultPath)?.version ?? null
}

function isFresh(entry: SuggestionCacheEntry, indexVersion: number | null): boolean {
	const built = entry.built
	if (!built || entry.indexed === null || built.schemaGeneration !== entry.schemaGeneration) {
		return false
	}
	if (indexVersion !== null) return built.indexVersion === indexVersion
	return built.indexVersion === null && built.generation === entry.generation
}

async function getSuggestionIndex(vaultPath: string): Promise<IndexedProperty[]> {
	const entry = getSuggestionCacheEntry(vaultPath)
	for (;;) {
		const indexVersion = getIndexVersion(vaultPath)
		if (entry.indexed !== null && isFresh(entry, indexVersion)) return entry.indexed
		if (!entry.pending) {
			const built = {
				generation: entry.generation,
				schemaGeneration: entry.schemaGeneration,
				indexVersion,
			}
			entry.pending = buildIndex(vaultPath)
				.then((indexed) => {
					if (built.schemaGeneration !== entry.schemaGeneration) return
					if (built.indexVersion === null && built.generation !== entry.generation) return
					entry.indexed = indexed
					entry.built = built
				})
				.finally(() => {
					entry.pending = null
				})
		}
		await entry.pending
		if (entry.indexed !== null && entry.built?.schemaGeneration === entry.schemaGeneration) {
			if (entry.built.indexVersion !== null || entry.built.generation === entry.generation) {
				return entry.indexed
			}
		}
	}
}

export function invalidatePropertySuggestions(vaultPath?: string): void {
	const targets = vaultPath ? [getSuggestionCacheEntry(vaultPath)] : suggestionCache.values()
	for (const entry of targets) entry.generation++
}

export function invalidatePropertySuggestionSchema(vaultPath?: string): void {
	const targets = vaultPath ? [getSuggestionCacheEntry(vaultPath)] : suggestionCache.values()
	for (const entry of targets) entry.schemaGeneration++
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

export async function getPropertyValueUsage(
	vaultPath: string,
	key: string,
): Promise<PropertyValueUsage> {
	const indexed = (await getSuggestionIndex(vaultPath)).find(
		(entry) => entry.definition.key.toLocaleLowerCase() === key.toLocaleLowerCase(),
	)
	return {
		notes: indexed?.usage ?? 0,
		values: indexed ? Object.fromEntries(indexed.values) : {},
	}
}
