import { argon2id } from "hash-wasm"

const KDF_SALT_LENGTH = 16
const NONCE_LENGTH = 12
const PKCS8_X25519_PREFIX_LENGTH = 16
const AUTH_INFO = "cortex/auth/v1"
const WRAP_INFO = "cortex/wrap/v1"

export const MIN_PASSWORD_LENGTH = 8

export interface DerivedAccountKeys {
	authKey: string
	wrapKey: Uint8Array
}

export interface WebAccountIdentity {
	authKey: string
	kdfSalt: string
	publicKey: string
	encryptedPrivateKey: string
}

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
	let binary = ""
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary)
}

function toBase64Url(bytes: Uint8Array): string {
	return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function fromBase64(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
	return bytes
}

async function hkdf(ikm: Uint8Array, info: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
		"deriveBits",
	])
	const bits = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode(info) },
		key,
		256,
	)
	return new Uint8Array(bits)
}

export async function deriveAccountKeys(
	password: string,
	kdfSalt: string,
): Promise<DerivedAccountKeys> {
	const master = await argon2id({
		password,
		salt: fromBase64(kdfSalt),
		parallelism: 1,
		iterations: 3,
		memorySize: 65536,
		hashLength: 32,
		outputType: "binary",
	})
	const [authKey, wrapKey] = await Promise.all([hkdf(master, AUTH_INFO), hkdf(master, WRAP_INFO)])
	return { authKey: toBase64Url(authKey), wrapKey }
}

async function encrypt(plaintext: Uint8Array, rawKey: Uint8Array): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey("raw", rawKey as BufferSource, "AES-GCM", false, [
		"encrypt",
	])
	const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext as BufferSource),
	)
	const blob = new Uint8Array(nonce.length + sealed.length)
	blob.set(nonce)
	blob.set(sealed, nonce.length)
	return blob
}

export async function createWebAccountIdentity(password: string): Promise<WebAccountIdentity> {
	const kdfSalt = toBase64(crypto.getRandomValues(new Uint8Array(KDF_SALT_LENGTH)))
	const derived = await deriveAccountKeys(password, kdfSalt)
	const pair = (await crypto.subtle.generateKey({ name: "X25519" }, true, [
		"deriveBits",
	])) as CryptoKeyPair
	const [publicKey, pkcs8] = await Promise.all([
		crypto.subtle.exportKey("raw", pair.publicKey),
		crypto.subtle.exportKey("pkcs8", pair.privateKey),
	])
	const privateKey = new Uint8Array(pkcs8).slice(PKCS8_X25519_PREFIX_LENGTH)
	return {
		authKey: derived.authKey,
		kdfSalt,
		publicKey: toBase64(new Uint8Array(publicKey)),
		encryptedPrivateKey: toBase64(await encrypt(privateKey, derived.wrapKey)),
	}
}
