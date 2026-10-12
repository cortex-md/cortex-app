import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { safeStorage } from "electron"
import type { MainApi } from "../contract"
import { credentialsPath } from "../paths"

type CredentialEntries = Record<string, string>

const RENDERER_KEY_PREFIXES = ["server_url", "sync-env-secret:"]

let entries: CredentialEntries | null = null
let flushScheduled = false

function canPersist(): boolean {
	return safeStorage.isEncryptionAvailable()
}

function load(): CredentialEntries {
	if (entries) return entries
	entries = {}
	const path = credentialsPath()
	if (!existsSync(path) || !canPersist()) return entries
	try {
		entries = JSON.parse(safeStorage.decryptString(readFileSync(path))) as CredentialEntries
	} catch (error) {
		console.error("[keychain] failed to read credential store:", error)
	}
	return entries
}

function flush(): void {
	flushScheduled = false
	if (!entries || !canPersist()) return
	const path = credentialsPath()
	const temporaryPath = `${path}.tmp`
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(temporaryPath, safeStorage.encryptString(JSON.stringify(entries)), { mode: 0o600 })
	renameSync(temporaryPath, path)
}

function scheduleFlush(): void {
	if (flushScheduled) return
	flushScheduled = true
	setImmediate(flush)
}

export function get(account: string): string | null {
	return load()[account] ?? null
}

export function set(account: string, value: string): void {
	load()[account] = value
	scheduleFlush()
}

function remove(account: string): void {
	const store = load()
	if (!(account in store)) return
	delete store[account]
	scheduleFlush()
}

export { remove as delete }

function assertRendererKey(key: string): string {
	if (!RENDERER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
		throw new Error(`Keychain key is not accessible from the renderer: ${key}`)
	}
	return key
}

export const keychainApi = {
	get: async (key) => get(assertRendererKey(key)),
	set: async (key, value) => set(assertRendererKey(key), value),
	delete: async (key) => remove(assertRendererKey(key)),
} satisfies MainApi["keychain"]
