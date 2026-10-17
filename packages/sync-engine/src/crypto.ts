import { vekSecretKey } from "@cortex/sync-api"
import { concatBytes, fromBase64, toBase64 } from "./bytes"
import { syncRuntime } from "./runtime"

export { vekSecretKey }

const KEY_LENGTH = 32
const NONCE_LENGTH = 12
const TAG_LENGTH = 16

export function generateKey(): Uint8Array {
	return syncRuntime().crypto.randomBytes(KEY_LENGTH)
}

export function encodeVek(vek: Uint8Array): string {
	return toBase64(vek)
}

export function assertVaultKey(vek: Uint8Array): Uint8Array {
	if (vek.length !== KEY_LENGTH) throw new Error("Invalid vault encryption key length")
	return vek
}

export function decodeVek(encoded: string): Uint8Array {
	return assertVaultKey(fromBase64(encoded))
}

export function encrypt(plaintext: Uint8Array, key: Uint8Array): Uint8Array {
	const { crypto } = syncRuntime()
	const nonce = crypto.randomBytes(NONCE_LENGTH)
	const { ciphertext, tag } = crypto.aes256GcmEncrypt(key, nonce, plaintext)
	return concatBytes([nonce, ciphertext, tag])
}

export function decrypt(blob: Uint8Array, key: Uint8Array): Uint8Array {
	if (blob.length < NONCE_LENGTH + TAG_LENGTH) throw new Error("Ciphertext too short")
	const nonce = blob.subarray(0, NONCE_LENGTH)
	const ciphertext = blob.subarray(NONCE_LENGTH, blob.length - TAG_LENGTH)
	return syncRuntime().crypto.aes256GcmDecrypt(
		key,
		nonce,
		ciphertext,
		blob.subarray(blob.length - TAG_LENGTH),
	)
}
