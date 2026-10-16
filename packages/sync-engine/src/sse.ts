import {
	type ApiClient,
	eventsPath,
	expectOk,
	mapRemoteChange,
	type RemoteChange,
	type RemoteChangeResponse,
} from "@cortex/sync-api"
import { type AccessDenial, accessDenial } from "./util"

const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 300_000

export interface SseHandlers {
	onConnected(): void
	onDisconnected(): void
	onChange(change: RemoteChange): void
	onVaultEvent(event: string, payload: Record<string, unknown>): void
	onAccessDenied(denial: AccessDenial): void
	onReset(): void
}

interface SseMessage {
	event: string
	data: string
	id: string
}

function createSseParser(onMessage: (message: SseMessage) => void): (chunk: string) => void {
	let buffer = ""
	let event = ""
	let data: string[] = []
	let id = ""
	return (chunk) => {
		buffer += chunk
		let lineEnd = buffer.indexOf("\n")
		while (lineEnd >= 0) {
			const line = buffer.slice(0, lineEnd).replace(/\r$/, "")
			buffer = buffer.slice(lineEnd + 1)
			if (line === "") {
				if (data.length > 0) onMessage({ event: event || "message", data: data.join("\n"), id })
				event = ""
				data = []
				id = ""
			} else if (!line.startsWith(":")) {
				const colon = line.indexOf(":")
				const field = colon < 0 ? line : line.slice(0, colon)
				const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "")
				if (field === "event") event = value
				else if (field === "data") data.push(value)
				else if (field === "id") id = value
			}
			lineEnd = buffer.indexOf("\n")
		}
	}
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms)
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer)
				resolve()
			},
			{ once: true },
		)
	})
}

export class SseClient {
	private readonly controller = new AbortController()
	private connected = false

	constructor(
		private readonly api: ApiClient,
		private readonly vaultId: string,
		private lastEventId: string | null,
		private readonly handlers: SseHandlers,
	) {}

	start(): void {
		this.run().catch(() => undefined)
	}

	stop(): void {
		this.controller.abort()
	}

	private async run(): Promise<void> {
		const signal = this.controller.signal
		let backoff = INITIAL_BACKOFF_MS
		while (!signal.aborted) {
			this.connected = false
			try {
				await this.stream(signal)
			} catch (error) {
				if (signal.aborted) return
				const denial = accessDenial(error)
				if (denial) {
					this.handlers.onAccessDenied(denial)
					return
				}
			}
			if (signal.aborted) return
			if (this.connected) backoff = INITIAL_BACKOFF_MS
			this.handlers.onDisconnected()
			await sleep(backoff + Math.floor(Math.random() * (backoff / 4 + 1)), signal)
			backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
		}
	}

	private async stream(signal: AbortSignal): Promise<void> {
		const headers: Record<string, string> = { Accept: "text/event-stream" }
		if (this.lastEventId) headers["Last-Event-ID"] = this.lastEventId
		const response = await expectOk(
			await this.api.request("GET", eventsPath(this.vaultId), { headers, signal }),
			"SSE connection",
		)
		if (!response.body) throw new Error("SSE connection failed: missing response body")
		this.connected = true
		this.handlers.onConnected()

		const parse = createSseParser((message) => this.handleMessage(message))
		const decoder = new TextDecoder()
		const reader = response.body.getReader()
		while (true) {
			const { done, value } = await reader.read()
			if (done) return
			parse(decoder.decode(value, { stream: true }))
		}
	}

	private handleMessage(message: SseMessage): void {
		if (message.event === "reset") {
			this.lastEventId = null
			this.handlers.onReset()
			return
		}
		if (message.id) this.lastEventId = message.id
		let raw: RemoteChangeResponse
		try {
			raw = JSON.parse(message.data) as RemoteChangeResponse
		} catch {
			return
		}
		if (typeof raw.file_path !== "string") {
			if (message.event !== "ping" && raw && typeof raw === "object") {
				this.handlers.onVaultEvent(message.event, raw as unknown as Record<string, unknown>)
			}
			return
		}
		this.handlers.onChange(mapRemoteChange({ ...raw, id: message.id || null }, message.event))
	}
}
