import { getCache, type RuntimeCache } from "@vercel/functions"

const STALE_FALLBACK_SECONDS = 7 * 24 * 60 * 60

interface CacheEntry<Value> {
	value: Value
	storedAt: number
}

export interface CachedValue<Value> {
	value: Value
	isStale: boolean
}

let runtimeCache: RuntimeCache | null | undefined

function cacheStore() {
	if (runtimeCache === undefined) {
		try {
			runtimeCache = getCache({ namespace: "cortex-web" })
		} catch {
			runtimeCache = null
		}
	}
	return runtimeCache
}

export async function readCache<Value>(key: string): Promise<CacheEntry<Value> | null> {
	try {
		const entry = (await cacheStore()?.get(key)) as CacheEntry<Value> | null | undefined
		return entry && typeof entry.storedAt === "number" ? entry : null
	} catch {
		return null
	}
}

export async function writeCache<Value>(
	key: string,
	value: Value,
	ttlSeconds: number,
	tags?: string[],
) {
	try {
		await cacheStore()?.set(key, { value, storedAt: Date.now() } satisfies CacheEntry<Value>, {
			ttl: ttlSeconds + STALE_FALLBACK_SECONDS,
			...(tags?.length ? { tags } : {}),
		})
	} catch {}
}

export async function withCache<Value>({
	key,
	ttlSeconds,
	tags,
	load,
}: {
	key: string
	ttlSeconds: number
	tags?: string[]
	load: () => Promise<Value | null>
}): Promise<CachedValue<Value> | null> {
	const entry = await readCache<Value>(key)
	if (entry && Date.now() - entry.storedAt < ttlSeconds * 1000) {
		return { value: entry.value, isStale: false }
	}

	const next = await load()
	if (next !== null) {
		await writeCache(key, next, ttlSeconds, tags)
		return { value: next, isStale: false }
	}

	return entry ? { value: entry.value, isStale: true } : null
}
