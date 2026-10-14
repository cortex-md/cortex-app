import { readCache, writeCache } from "./cache"

const GITHUB_API_VERSION = "2022-11-28"
const ETAG_TTL_SECONDS = 24 * 60 * 60

export const githubRepo = "cortex-md/cortex-app"

export function githubApiHeaders(userAgent: string, token = process.env.GITHUB_TOKEN?.trim()) {
	return {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
		"User-Agent": userAgent,
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	}
}

interface StoredResponse {
	etag: string
	body: string
}

export const githubFetch: typeof fetch = async (input, init) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
	const key = `github-etag:${url}`
	const stored = (await readCache<StoredResponse>(key))?.value
	const headers = new Headers(init?.headers)
	if (stored) headers.set("If-None-Match", stored.etag)

	const response = await fetch(input, { ...init, headers })
	if (response.status === 304 && stored) {
		return new Response(stored.body, {
			status: 200,
			headers: { "Content-Type": "application/json", ETag: stored.etag },
		})
	}

	const etag = response.headers.get("ETag")
	if (!response.ok || !etag) return response

	const body = await response.text()
	await writeCache(key, { etag, body } satisfies StoredResponse, ETAG_TTL_SECONDS)
	return new Response(body, {
		status: response.status,
		headers: { "Content-Type": "application/json", ETag: etag },
	})
}
