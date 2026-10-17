import { createHash, type Hash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { rename, rm, stat } from "node:fs/promises"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import { toUpdateError, UpdateError } from "./errors"
import type { UrlPolicy } from "./manifest"
import type { FetchLike } from "./source"

export interface DownloadProgress {
	downloaded: number
	total: number
}

export interface DownloadOptions {
	url: string
	destination: string
	sha256: string
	size: number
	fetch: FetchLike
	allowResponseUrl: UrlPolicy
	onProgress?: (progress: DownloadProgress) => void
	progressIntervalMs?: number
	signal?: AbortSignal
	now?: () => number
}

export interface DownloadResult {
	path: string
	resumedFrom: number
	reused: boolean
}

const DEFAULT_PROGRESS_INTERVAL_MS = 250

async function fileSize(path: string): Promise<number | null> {
	try {
		return (await stat(path)).size
	} catch {
		return null
	}
}

async function hashExisting(path: string, hash: Hash): Promise<void> {
	for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
}

export async function sha256File(path: string): Promise<string> {
	const hash = createHash("sha256")
	await hashExisting(path, hash)
	return hash.digest("hex")
}

async function openResponse(
	options: DownloadOptions,
	offset: number,
): Promise<{ response: Response; offset: number }> {
	const headers: Record<string, string> = { "User-Agent": "Cortex desktop updater" }
	if (offset > 0) headers.Range = `bytes=${offset}-`
	let response: Response
	try {
		response = await options.fetch(options.url, {
			headers,
			redirect: "follow",
			signal: options.signal,
		})
	} catch (error) {
		throw toUpdateError(error, "NETWORK")
	}
	if (response.url && !options.allowResponseUrl(response.url)) {
		throw new UpdateError("NETWORK", "Update download was redirected to an untrusted host")
	}
	if (offset > 0 && response.status === 416) {
		await response.body?.cancel()
		return openResponse(options, 0)
	}
	if (offset > 0 && response.status === 200) return { response, offset: 0 }
	if (!response.ok || !response.body) {
		throw new UpdateError("NETWORK", `Update download failed with HTTP ${response.status}`)
	}
	return { response, offset }
}

/**
 * Streams `url` into `<destination>.part`, hashing as it writes, and renames it to `destination`
 * only when the size and SHA-256 match. An interrupted download keeps its `.part` file and resumes
 * with a `Range` request on the next call.
 */
export async function downloadVerified(options: DownloadOptions): Promise<DownloadResult> {
	const expectedHash = options.sha256.toLowerCase()
	if ((await fileSize(options.destination)) === options.size) {
		if ((await sha256File(options.destination)) === expectedHash) {
			return { path: options.destination, resumedFrom: options.size, reused: true }
		}
		await rm(options.destination, { force: true })
	}

	const partPath = `${options.destination}.part`
	let existing = (await fileSize(partPath)) ?? 0
	if (existing > options.size) {
		await rm(partPath, { force: true })
		existing = 0
	}

	const opened = await openResponse(options, existing)
	const offset = opened.offset
	const hash = createHash("sha256")
	if (offset > 0) await hashExisting(partPath, hash)

	const now = options.now ?? Date.now
	const interval = options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS
	let downloaded = offset
	let lastEmit = Number.NEGATIVE_INFINITY
	const report = (force: boolean) => {
		const time = now()
		if (!force && time - lastEmit < interval) return
		lastEmit = time
		options.onProgress?.({ downloaded, total: options.size })
	}
	report(true)

	const meter = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			downloaded += chunk.length
			if (downloaded > options.size) {
				callback(new UpdateError("HASH_MISMATCH", "Update download is larger than expected"))
				return
			}
			hash.update(chunk)
			report(false)
			callback(null, chunk)
		},
	})

	try {
		await pipeline(
			Readable.fromWeb(opened.response.body as unknown as WebReadableStream<Uint8Array>),
			meter,
			createWriteStream(partPath, { flags: offset > 0 ? "a" : "w" }),
		)
	} catch (error) {
		if (error instanceof UpdateError && error.code === "HASH_MISMATCH") {
			await rm(partPath, { force: true })
		}
		throw toUpdateError(error, "NETWORK")
	}
	report(true)

	if (downloaded !== options.size) {
		throw new UpdateError("NETWORK", "Update download ended before it was complete")
	}
	if (hash.digest("hex") !== expectedHash) {
		await rm(partPath, { force: true })
		throw new UpdateError("HASH_MISMATCH", "Update package checksum does not match the manifest")
	}
	await rename(partPath, options.destination)
	return { path: options.destination, resumedFrom: offset, reused: false }
}
