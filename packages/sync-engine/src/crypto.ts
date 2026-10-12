import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { vekSecretKey } from "@cortex/sync-api"

export { vekSecretKey }

const KEY_LENGTH = 32
const NONCE_LENGTH = 12
const TAG_LENGTH = 16

export function generateKey(): Buffer {
	return randomBytes(KEY_LENGTH)
}

export function encodeVek(vek: Uint8Array): string {
	return Buffer.from(vek).toString("base64")
}

export function assertVaultKey(vek: Buffer): Buffer {
	if (vek.length !== KEY_LENGTH) throw new Error("Invalid vault encryption key length")
	return vek
}

export function decodeVek(encoded: string): Buffer {
	return assertVaultKey(Buffer.from(encoded, "base64"))
}

export function encrypt(plaintext: Uint8Array, key: Uint8Array): Buffer {
	const nonce = randomBytes(NONCE_LENGTH)
	const cipher = createCipheriv("aes-256-gcm", key, nonce)
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
	return Buffer.concat([nonce, encrypted, cipher.getAuthTag()])
}

export function decrypt(blob: Uint8Array, key: Uint8Array): Buffer {
	if (blob.length < NONCE_LENGTH + TAG_LENGTH) throw new Error("Ciphertext too short")
	const nonce = blob.subarray(0, NONCE_LENGTH)
	const ciphertext = blob.subarray(NONCE_LENGTH, blob.length - TAG_LENGTH)
	const decipher = createDecipheriv("aes-256-gcm", key, nonce)
	decipher.setAuthTag(blob.subarray(blob.length - TAG_LENGTH))
	return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
