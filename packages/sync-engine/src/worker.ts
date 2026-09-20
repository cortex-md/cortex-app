import { SyncEngine } from "./engine"
import { type DeviceLike, type KeychainLike, SyncHttpClient } from "./http"
import type { SyncCommand } from "./state"

interface WorkerMessage {
	type: string
	id?: string
	command?: SyncCommand
	method?: string
	args?: Record<string, unknown>
	account?: string
	value?: string
	error?: string
	result?: unknown
}

declare const process: NodeJS.Process & {
	parentPort?: {
		on(event: "message", listener: (message: unknown) => void): void
		postMessage(message: unknown): void
	}
}

const parentPort = process.parentPort
if (!parentPort) {
	throw new Error("sync-engine worker must run inside an Electron UtilityProcess")
}

const keychainCache = new Map<string, string>()
let deviceId = "unknown-device"

const syncKeychain: KeychainLike = {
	get(account) {
		return keychainCache.get(account) ?? null
	},
	set(account, value) {
		keychainCache.set(account, value)
		parentPort.postMessage({ type: "keychain", method: "set", account, value })
	},
	delete(account) {
		keychainCache.delete(account)
		parentPort.postMessage({ type: "keychain", method: "delete", account })
	},
}

const device: DeviceLike = {
	getDeviceId() {
		return deviceId
	},
}

const client = new SyncHttpClient({
	keychain: syncKeychain,
	device,
	onSessionExpired: () => {
		parentPort.postMessage({ type: "event", method: "auth-session-expired" })
	},
})

const engine = new SyncEngine({
	client,
	keychain: syncKeychain,
	device,
	onEvent: (name, payload) => {
		parentPort.postMessage({
			type: "event",
			method: name,
			args: payload as Record<string, unknown> | undefined,
		})
	},
})

void engine.run()

parentPort.on("message", (raw) => {
	const message = raw as WorkerMessage
	switch (message.type) {
		case "bootstrap": {
			deviceId = String(message.args?.deviceId ?? deviceId)
			const entries = (message.args?.keychainEntries ?? {}) as Record<string, string>
			keychainCache.clear()
			for (const [account, value] of Object.entries(entries)) {
				keychainCache.set(account, value)
			}
			if (message.id) {
				parentPort.postMessage({ type: "ready", id: message.id })
			}
			return
		}
		case "command": {
			if (message.command) engine.enqueue(message.command)
			if (message.id) {
				parentPort.postMessage({ type: "result", id: message.id, result: null })
			}
			return
		}
		case "keychainResult": {
			if (message.account && typeof message.result === "string") {
				keychainCache.set(message.account, message.result)
			}
			return
		}
		case "stop": {
			engine.enqueue({ type: "stop" })
			engine.stopLoop()
			if (message.id) {
				parentPort.postMessage({ type: "result", id: message.id, result: null })
			}
			return
		}
		default:
			return
	}
})
