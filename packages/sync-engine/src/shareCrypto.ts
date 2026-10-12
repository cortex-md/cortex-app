import { promisify } from "node:util"
import { gunzip, gzip } from "node:zlib"
import { decrypt, encrypt, generateKey } from "./crypto"

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)
const SHARE_KEY_LENGTH = 32

export interface ShareKey {
	key: Buffer
	wrappedKey: string
}

export function createShareKey(vek: Uint8Array): ShareKey {
	const key = generateKey()
	return { key, wrappedKey: encrypt(key, vek).toString("base64") }
}

export function unwrapShareKey(wrappedKey: string, vek: Uint8Array): Buffer {
	return decrypt(Buffer.from(wrappedKey, "base64"), vek)
}

export function encodeShareKey(key: Uint8Array): string {
	return Buffer.from(key).toString("base64url")
}

export function decodeShareKey(encoded: string): Buffer {
	const key = Buffer.from(encoded, "base64url")
	if (key.length !== SHARE_KEY_LENGTH) throw new Error("Invalid share link key")
	return key
}

export async function sealShareBundle(plaintext: Uint8Array, key: Uint8Array): Promise<Buffer> {
	return encrypt(await gzipAsync(plaintext), key)
}

export async function openShareBundle(ciphertext: Uint8Array, key: Uint8Array): Promise<Buffer> {
	return await gunzipAsync(decrypt(ciphertext, key))
}
