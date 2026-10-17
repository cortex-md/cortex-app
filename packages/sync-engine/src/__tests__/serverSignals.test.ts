import {
	type ApiClient,
	expectOk,
	isCursorExpired,
	isPayloadTooLarge,
	SyncError,
	subscriptionCode,
	throttleDelayMs,
} from "@cortex/sync-api"
import { describe, expect, it, vi } from "vitest"
import { retryThrottled } from "../runner"
import { SseClient, type SseHandlers } from "../sse"

async function failure(status: number, body: object, headers: Record<string, string> = {}) {
	return await expectOk(new Response(JSON.stringify(body), { status, headers }), "Request").catch(
		(error: unknown) => error,
	)
}

describe("server error signals", () => {
	it("honours Retry-After on throttled responses", async () => {
		const busy = await failure(503, { code: "server_busy" }, { "Retry-After": "7" })
		expect(throttleDelayMs(busy)).toBe(7000)

		const limited = await failure(429, { code: "rate_limited" })
		expect(throttleDelayMs(limited)).toBe(5000)

		const attempts = await failure(429, { code: "too_many_attempts" }, { "Retry-After": "60" })
		expect(throttleDelayMs(attempts)).toBeNull()
	})

	it("recognises expired cursors and oversized payloads", async () => {
		expect(isCursorExpired(await failure(410, { code: "cursor_expired" }))).toBe(true)
		expect(isCursorExpired(await failure(410, { code: "invite_expired" }))).toBe(false)
		expect(isPayloadTooLarge(await failure(413, { code: "file_too_large" }))).toBe(true)
		expect(isPayloadTooLarge(new SyncError("permanent", "x", 400))).toBe(false)
	})

	it("reads subscription denials from the error code", () => {
		expect(subscriptionCode(403, JSON.stringify({ code: "subscription_expired" }))).toBe(
			"subscription_expired",
		)
		expect(subscriptionCode(402, "{}")).toBe("subscription_required")
		expect(subscriptionCode(403, JSON.stringify({ code: "forbidden" }))).toBeNull()
	})
})

describe("SseClient reset", () => {
	it("asks for a full resync and forgets the event cursor", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				const encoder = new TextEncoder()
				controller.enqueue(encoder.encode("retry: 5000\n\n"))
				controller.enqueue(encoder.encode('event: reset\ndata: {"reason":"cursor_expired"}\n\n'))
				controller.close()
			},
		})
		const requests: Record<string, string>[] = []
		const api = {
			request: vi.fn(
				async (_method: string, _path: string, options: { headers: Record<string, string> }) => {
					requests.push(options.headers)
					return requests.length === 1
						? new Response(body, { status: 200 })
						: new Response(null, { status: 503 })
				},
			),
		} as unknown as ApiClient
		const onReset = vi.fn()
		const handlers: SseHandlers = {
			onConnected: vi.fn(),
			onDisconnected: vi.fn(),
			onChange: vi.fn(),
			onVaultEvent: vi.fn(),
			onAccessDenied: vi.fn(),
			onReset,
		}
		const client = new SseClient(api, "vault", "42", handlers)

		client.start()
		await vi.waitFor(() => expect(onReset).toHaveBeenCalledTimes(1))
		await vi.waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(2), { timeout: 3000 })
		client.stop()

		expect(requests[0]?.["Last-Event-ID"]).toBe("42")
		expect(requests[1]?.["Last-Event-ID"]).toBeUndefined()
		expect(handlers.onVaultEvent).not.toHaveBeenCalled()
	})
})

describe("retryThrottled", () => {
	it("waits and retries while the server is busy, then surfaces other errors", async () => {
		let calls = 0
		const result = await retryThrottled(async () => {
			calls += 1
			if (calls < 3) throw new SyncError("transient", "busy", 503, "server_busy", null, 1)
			return "done"
		})
		expect(result).toBe("done")
		expect(calls).toBe(3)

		await expect(
			retryThrottled(async () => {
				throw new SyncError("permanent", "bad", 400, "invalid_input")
			}),
		).rejects.toThrow("bad")
	})
})
