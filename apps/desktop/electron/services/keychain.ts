import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { credentialsKeyPath, credentialsPath, cortexHomeDir } from "../paths"

interface EncryptedPayload {
	nonce: string
	data: string
}

type CredentialEntries = Record<string, string>

let store: {
	path: string
	key: Buffer
	entries: CredentialEntries
} | null = null

function encodeBase64(bytes: Buffer): string {
	return bytes.toString("base64")
}

function decodeBase64(value: string): Buffer {
	return Buffer.from(value, "base64")
}

function loadOrCreateKey(): Buffer {
	const path = credentialsKeyPath()
	if (existsSync(path)) {
		const raw = readFileSync(path)
		if (raw.length === 32) {
			return raw
		}
	}

	const key = randomBytes(32)
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(path, key)
	try {
		chmodSync(path, 0o600)
	} catch {
		// Best-effort on platforms without POSIX modes.
	}
	return key
}

function decryptFile(path: string, key: Buffer): CredentialEntries {
	const raw = readFileSync(path, "utf8")
	const payload = JSON.parse(raw) as EncryptedPayload
	const nonce = decodeBase64(payload.nonce)
	const ciphertext = decodeBase64(payload.data)
	if (ciphertext.length < 16) {
		throw new Error("failed to decrypt credential store")
	}
	const authTag = ciphertext.subarray(ciphertext.length - 16)
	const encrypted = ciphertext.subarray(0, ciphertext.length - 16)
	const decipher = createDecipheriv("aes-256-gcm", key, nonce)
	decipher.setAuthTag(authTag)
	const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()])
	return JSON.parse(plaintext.toString("utf8")) as CredentialEntries
}

function flush(path: string, key: Buffer, entries: CredentialEntries): void {
	const json = JSON.stringify(entries)
	const nonce = randomBytes(12)
	const cipher = createCipheriv("aes-256-gcm", key, nonce)
	const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()])
	const authTag = cipher.getAuthTag()
	const payload: EncryptedPayload = {
		nonce: encodeBase64(nonce),
		data: encodeBase64(Buffer.concat([encrypted, authTag])),
	}
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(path, JSON.stringify(payload), "utf8")
}

function withStore<T>(callback: (entries: CredentialEntries) => T): T {
	if (!store) {
		mkdirSync(cortexHomeDir(), { recursive: true })
		const key = loadOrCreateKey()
		const path = credentialsPath()
		let entries: CredentialEntries = {}
		if (existsSync(path)) {
			try {
				entries = decryptFile(path, key)
			} catch {
				entries = {}
			}
		}
		store = { path, key, entries }
	}
	return callback(store.entries)
}

export function set(account: string, value: string): void {
	withStore((entries) => {
		entries[account] = value
		flush(store!.path, store!.key, entries)
	})
}

export function get(account: string): string | null {
	return withStore((entries) => entries[account] ?? null)
}

export function deleteAccount(account: string): void {
	withStore((entries) => {
		delete entries[account]
		flush(store!.path, store!.key, entries)
	})
}

export { deleteAccount as delete }
