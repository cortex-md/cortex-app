import { createHash, randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { type DownloadOptions, downloadVerified } from "../../updates/download"

const payload = randomBytes(512 * 1024)
const payloadHash = createHash("sha256").update(payload).digest("hex")

interface ServerBehavior {
	cutAfterBytes: number | null
	ignoreRange: boolean
	requests: { range: string | undefined }[]
}

const behavior: ServerBehavior = { cutAfterBytes: null, ignoreRange: false, requests: [] }
let server: Server
let baseUrl: string
let workDir: string

function respond(request: IncomingMessage, response: ServerResponse): void {
	const range = request.headers.range
	behavior.requests.push({ range })
	const match = range && !behavior.ignoreRange ? /^bytes=(\d+)-$/.exec(range) : null
	const start = match ? Number(match[1]) : 0
	const body = payload.subarray(start)
	response.writeHead(match ? 206 : 200, {
		"Content-Length": String(body.length),
		...(match ? { "Content-Range": `bytes ${start}-${payload.length - 1}/${payload.length}` } : {}),
	})
	const cut = behavior.cutAfterBytes
	if (cut === null) {
		response.end(body)
		return
	}
	behavior.cutAfterBytes = null
	response.write(body.subarray(0, cut), () => {
		setTimeout(() => response.socket?.destroy(), 20)
	})
}

beforeAll(async () => {
	server = createServer(respond)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
	await new Promise((resolve) => server.close(resolve))
})

beforeEach(async () => {
	workDir = await mkdtemp(join(tmpdir(), "cortex-update-download-"))
	behavior.cutAfterBytes = null
	behavior.ignoreRange = false
	behavior.requests = []
})

afterEach(async () => {
	await rm(workDir, { recursive: true, force: true })
})

function options(overrides: Partial<DownloadOptions> = {}): DownloadOptions {
	return {
		url: `${baseUrl}/Cortex.zip`,
		destination: join(workDir, "Cortex.zip"),
		sha256: payloadHash,
		size: payload.length,
		fetch: (input, init) => fetch(input, init),
		allowResponseUrl: () => true,
		...overrides,
	}
}

describe("verified update download", () => {
	it("streams the package to disk and verifies its hash", async () => {
		const progress: number[] = []
		const result = await downloadVerified(
			options({ onProgress: ({ downloaded }) => progress.push(downloaded) }),
		)
		expect(result).toMatchObject({ resumedFrom: 0, reused: false })
		expect(Buffer.compare(await readFile(result.path), payload)).toBe(0)
		expect(progress.at(-1)).toBe(payload.length)
		expect(existsSync(`${result.path}.part`)).toBe(false)
	})

	it("resumes an interrupted download with a Range request", async () => {
		behavior.cutAfterBytes = 128 * 1024
		await expect(downloadVerified(options())).rejects.toMatchObject({ code: "NETWORK" })
		const partial = (await stat(join(workDir, "Cortex.zip.part"))).size
		expect(partial).toBeGreaterThan(0)
		expect(partial).toBeLessThan(payload.length)

		const result = await downloadVerified(options())
		expect(behavior.requests.at(-1)?.range).toBe(`bytes=${partial}-`)
		expect(result.resumedFrom).toBe(partial)
		expect(Buffer.compare(await readFile(result.path), payload)).toBe(0)
	})

	it("restarts from zero when the server ignores the Range header", async () => {
		await writeFile(join(workDir, "Cortex.zip.part"), payload.subarray(0, 1000))
		behavior.ignoreRange = true
		const result = await downloadVerified(options())
		expect(result.resumedFrom).toBe(0)
		expect(Buffer.compare(await readFile(result.path), payload)).toBe(0)
	})

	it("deletes the package when the hash does not match", async () => {
		await expect(downloadVerified(options({ sha256: "0".repeat(64) }))).rejects.toMatchObject({
			code: "HASH_MISMATCH",
		})
		expect(existsSync(join(workDir, "Cortex.zip"))).toBe(false)
		expect(existsSync(join(workDir, "Cortex.zip.part"))).toBe(false)
	})

	it("rejects a body larger than the manifest size", async () => {
		await expect(downloadVerified(options({ size: 1024 }))).rejects.toMatchObject({
			code: "HASH_MISMATCH",
		})
		expect(existsSync(join(workDir, "Cortex.zip.part"))).toBe(false)
	})

	it("refuses redirects to hosts outside the policy", async () => {
		await expect(
			downloadVerified(options({ allowResponseUrl: () => false })),
		).rejects.toMatchObject({
			code: "NETWORK",
		})
	})

	it("reuses a package that was already downloaded and verified", async () => {
		await writeFile(join(workDir, "Cortex.zip"), payload)
		const result = await downloadVerified(options())
		expect(result.reused).toBe(true)
		expect(behavior.requests).toHaveLength(0)
	})

	it("throttles progress events", async () => {
		const progress: number[] = []
		await downloadVerified(
			options({
				now: () => 0,
				progressIntervalMs: 250,
				onProgress: ({ downloaded }) => progress.push(downloaded),
			}),
		)
		expect(progress).toEqual([0, payload.length])
	})
})
