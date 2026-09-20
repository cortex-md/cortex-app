import {
	getAccessTokenForServer,
	isSubscriptionAccessError,
	type KeychainLike,
	subscriptionCodeFromText,
} from "./http"
import type { SyncCommand } from "./state"

export interface SseFileEvent {
	vault_uuid?: string
	file_path: string
	version: number
	actor_id: string
	device_id: string
	created_at?: string | null
	old_path?: string | null
}

export type SyncCommandSink = (command: SyncCommand) => void | Promise<void>

export class SseClient {
	private lastEventId: string | null
	private readonly ownDeviceId: string
	private readonly onCommand: SyncCommandSink
	private readonly keychain: KeychainLike
	private abortController: AbortController | null = null

	constructor(
		onCommand: SyncCommandSink,
		ownDeviceId: string,
		keychain: KeychainLike,
		lastEventId: string | null = null,
	) {
		this.onCommand = onCommand
		this.ownDeviceId = ownDeviceId
		this.keychain = keychain
		this.lastEventId = lastEventId
	}

	stop(): void {
		this.abortController?.abort()
		this.abortController = null
	}

	async connect(url: string, serverUrl: string, deviceId: string): Promise<void> {
		let backoffMs = 1000
		const maxBackoffMs = 300_000

		while (true) {
			if (this.abortController?.signal.aborted) return

			const accessToken = getAccessTokenForServer(this.keychain, serverUrl)
			if (!accessToken) {
				throw new Error("No access token available for SSE")
			}

			this.abortController = new AbortController()
			const signal = this.abortController.signal

			try {
				await this.streamEvents(url, accessToken, deviceId, signal)
				if (signal.aborted) return
				await this.onCommand({
					type: "sseDisconnected",
					lastEventId: this.lastEventId,
				})
				backoffMs = 1000
			} catch (error) {
				if (signal.aborted) return
				const message = error instanceof Error ? error.message : String(error)

				if (isSubscriptionAccessError(message)) {
					await this.onCommand({
						type: "accessDenied",
						reason: message,
						kind: "subscription",
						code: subscriptionCodeFromText(message),
					})
					return
				}

				if (message.includes("HTTP 403")) {
					await this.onCommand({
						type: "accessDenied",
						reason: message,
						kind: "vault",
						code: null,
					})
					return
				}

				await this.onCommand({
					type: "sseDisconnected",
					lastEventId: this.lastEventId,
				})

				const jitter = Math.floor(Math.random() * (backoffMs / 4 + 1))
				await sleep(backoffMs + jitter, signal)
				if (signal.aborted) return
				backoffMs = Math.min(backoffMs * 2, maxBackoffMs)
			}
		}
	}

	private async streamEvents(
		url: string,
		accessToken: string,
		deviceId: string,
		signal: AbortSignal,
	): Promise<void> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${accessToken}`,
			"X-Device-ID": deviceId,
			Accept: "text/event-stream",
		}
		if (this.lastEventId) {
			headers["Last-Event-ID"] = this.lastEventId
		}

		const response = await fetch(url, { headers, signal })
		if (!response.ok) {
			const body = await response.text().catch(() => "")
			throw new Error(`SSE connection failed: HTTP ${response.status}: ${body}`)
		}
		if (!response.body) {
			throw new Error("SSE connection failed: missing response body")
		}

		await this.onCommand({ type: "sseConnected" })

		const reader = response.body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""
		let currentEventType = ""
		let currentData = ""
		let currentId = ""

		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })

			while (true) {
				const lineEnd = buffer.indexOf("\n")
				if (lineEnd < 0) break
				const line = buffer.slice(0, lineEnd).replace(/\r$/, "")
				buffer = buffer.slice(lineEnd + 1)

				if (line === "") {
					if (currentData) {
						await this.handleEvent(currentEventType, currentData, currentId)
						if (currentId) this.lastEventId = currentId
					}
					currentEventType = ""
					currentData = ""
					currentId = ""
				} else if (line.startsWith("event:")) {
					currentEventType = line.slice("event:".length).trim()
				} else if (line.startsWith("data:")) {
					currentData = line.slice("data:".length).trim()
				} else if (line.startsWith("id:")) {
					currentId = line.slice("id:".length).trim()
				}
			}
		}
	}

	async handleEvent(eventType: string, data: string, id: string): Promise<void> {
		const eventId = id ? id : null
		switch (eventType) {
			case "file_created":
			case "file_updated": {
				const event = JSON.parse(data) as SseFileEvent
				if (event.device_id === this.ownDeviceId) {
					await this.sendProcessedEvent(eventId)
					return
				}
				await this.onCommand({
					type: "remoteFileChanged",
					path: event.file_path,
					version: event.version,
					actorId: event.actor_id,
					deviceId: event.device_id,
					editedAt: event.created_at ?? null,
					created: eventType === "file_created",
					eventId,
				})
				return
			}
			case "file_deleted": {
				const event = JSON.parse(data) as SseFileEvent
				if (event.device_id === this.ownDeviceId) {
					await this.sendProcessedEvent(eventId)
					return
				}
				await this.onCommand({
					type: "remoteFileDeleted",
					path: event.file_path,
					eventId,
				})
				return
			}
			case "file_renamed": {
				const event = JSON.parse(data) as SseFileEvent
				if (event.device_id === this.ownDeviceId) {
					await this.sendProcessedEvent(eventId)
					return
				}
				if (event.old_path) {
					await this.onCommand({
						type: "remoteFileRenamed",
						oldPath: event.old_path,
						newPath: event.file_path,
						eventId,
					})
				} else {
					await this.sendProcessedEvent(eventId)
				}
				return
			}
			default:
				await this.sendProcessedEvent(eventId)
		}
	}

	private async sendProcessedEvent(eventId: string | null): Promise<void> {
		if (!eventId) return
		await this.onCommand({ type: "remoteEventProcessed", eventId })
	}
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			resolve()
			return
		}
		const timer = setTimeout(resolve, ms)
		const onAbort = () => {
			clearTimeout(timer)
			reject(new DOMException("Aborted", "AbortError"))
		}
		signal.addEventListener("abort", onAbort, { once: true })
	}).catch(() => undefined)
}
