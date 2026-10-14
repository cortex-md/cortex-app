import { argon2idAsync } from "@noble/hashes/argon2"

import type { Argon2Params, KdfMessage, KdfViewHandle } from "./kdfProtocol"

const READY_TIMEOUT_MS = 4000
const DERIVE_TIMEOUT_MS = 60_000
const JS_YIELD_MS = 16

interface Pending {
	resolve: (hash: Uint8Array) => void
	reject: (error: Error) => void
}

let handle: KdfViewHandle | null = null
let ready = false
let nextId = 1
const pending = new Map<number, Pending>()
const readyWaiters = new Set<() => void>()

export function attachKdfView(view: KdfViewHandle | null): void {
	handle = view
	if (!view) ready = false
}

export async function receiveKdfMessage(message: KdfMessage): Promise<void> {
	if (message.type === "ready") {
		ready = true
		for (const waiter of readyWaiters) waiter()
		readyWaiters.clear()
		return
	}
	const request = pending.get(message.id)
	if (!request) return
	pending.delete(message.id)
	if (message.type === "result") request.resolve(Uint8Array.from(message.hash))
	else request.reject(new Error(message.message))
}

function waitForView(): Promise<boolean> {
	if (ready && handle) return Promise.resolve(true)
	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer)
			resolve(Boolean(handle))
		}
		const timer = setTimeout(() => {
			readyWaiters.delete(done)
			resolve(false)
		}, READY_TIMEOUT_MS)
		readyWaiters.add(done)
	})
}

function deriveInView(
	view: KdfViewHandle,
	password: string,
	salt: Uint8Array,
	params: Argon2Params,
): Promise<Uint8Array> {
	const id = nextId++
	return new Promise<Uint8Array>((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id)
			reject(new Error("Deriving the account key took too long. Try again."))
		}, DERIVE_TIMEOUT_MS)
		pending.set(id, {
			reject: (error) => {
				clearTimeout(timer)
				reject(error)
			},
			resolve: (hash) => {
				clearTimeout(timer)
				resolve(hash)
			},
		})
		view.derive({ ...params, id, password, salt: Array.from(salt) })
	})
}

export async function deriveArgon2id(
	password: string,
	salt: Uint8Array,
	params: Argon2Params,
): Promise<Uint8Array> {
	const startedAt = Date.now()
	const view = (await waitForView()) ? handle : null
	console.info(`[kdf] argon2id started in ${view ? "webview" : "hermes"}`)
	const hash = view
		? await deriveInView(view, password, salt, params)
		: await deriveInHermes(password, salt, params)
	console.info(`[kdf] argon2id in ${view ? "webview" : "hermes"}: ${Date.now() - startedAt} ms`)
	return hash
}

function deriveInHermes(
	password: string,
	salt: Uint8Array,
	params: Argon2Params,
): Promise<Uint8Array> {
	return argon2idAsync(password, salt, {
		asyncTick: JS_YIELD_MS,
		dkLen: params.hashLength,
		m: params.memoryCost,
		p: params.parallelism,
		t: params.timeCost,
	})
}
