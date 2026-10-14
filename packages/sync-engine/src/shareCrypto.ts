import { fromBase64, fromBase64Url, toBase64, toBase64Url } from "./bytes"
import { decrypt, encrypt, generateKey } from "./crypto"
import { syncRuntime } from "./runtime"

const SHARE_KEY_LENGTH = 32

export interface ShareKey {
	key: Uint8Array
	wrappedKey: string
}

export function createShareKey(vek: Uint8Array): ShareKey {
	const key = generateKey()
	return { key, wrappedKey: toBase64(encrypt(key, vek)) }
}

export function unwrapShareKey(wrappedKey: string, vek: Uint8Array): Uint8Array {
	return decrypt(fromBase64(wrappedKey), vek)
}

export function encodeShareKey(key: Uint8Array): string {
	return toBase64Url(key)
}

export function decodeShareKey(encoded: string): Uint8Array {
	const key = fromBase64Url(encoded)
	if (key.length !== SHARE_KEY_LENGTH) throw new Error("Invalid share link key")
	return key
}

export async function sealShareBundle(plaintext: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
	return encrypt(await syncRuntime().crypto.gzip(plaintext), key)
}

export async function openShareBundle(
	ciphertext: Uint8Array,
	key: Uint8Array,
): Promise<Uint8Array> {
	return await syncRuntime().crypto.gunzip(decrypt(ciphertext, key))
}
