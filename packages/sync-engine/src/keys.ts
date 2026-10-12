import {
	createHash,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync,
	type KeyObject,
	randomBytes,
} from "node:crypto"
import { decrypt, encrypt } from "./crypto"

const X25519_KEY_LENGTH = 32
const PKCS8_X25519_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex")
const SPKI_X25519_PREFIX = Buffer.from("302a300506032b656e032100", "hex")
const SEALED_KEY_VERSION = 0x01
const SEAL_INFO = "cortex/vek-seal/v1"
const RECOVERY_INFO = "cortex/recovery/v1"
const RECOVERY_KEY_LENGTH = 32
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const CROCKFORD_ALIASES: Record<string, string> = { I: "1", L: "1", O: "0" }

export function hkdf(ikm: Uint8Array, info: string, salt: Uint8Array = Buffer.alloc(0)): Buffer {
	return Buffer.from(hkdfSync("sha256", ikm, salt, info, 32))
}

function assertKeyLength(key: Buffer, label: string): Buffer {
	if (key.length !== X25519_KEY_LENGTH) throw new Error(`Invalid ${label} length`)
	return key
}

function privateKeyObject(privateKey: Uint8Array): KeyObject {
	return createPrivateKey({
		key: Buffer.concat([
			PKCS8_X25519_PREFIX,
			assertKeyLength(Buffer.from(privateKey), "private key"),
		]),
		format: "der",
		type: "pkcs8",
	})
}

function publicKeyObject(publicKey: Uint8Array): KeyObject {
	return createPublicKey({
		key: Buffer.concat([SPKI_X25519_PREFIX, assertKeyLength(Buffer.from(publicKey), "public key")]),
		format: "der",
		type: "spki",
	})
}

function rawPublicKey(key: KeyObject): Buffer {
	return Buffer.from(key.export({ format: "der", type: "spki" })).subarray(
		SPKI_X25519_PREFIX.length,
	)
}

function rawPrivateKey(key: KeyObject): Buffer {
	return Buffer.from(key.export({ format: "der", type: "pkcs8" })).subarray(
		PKCS8_X25519_PREFIX.length,
	)
}

export interface X25519KeyPair {
	publicKey: Buffer
	privateKey: Buffer
}

export function generateX25519KeyPair(): X25519KeyPair {
	const { publicKey, privateKey } = generateKeyPairSync("x25519")
	return { publicKey: rawPublicKey(publicKey), privateKey: rawPrivateKey(privateKey) }
}

export function x25519PublicKey(privateKey: Uint8Array): Buffer {
	return rawPublicKey(createPublicKey(privateKeyObject(privateKey)))
}

function sharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Buffer {
	return diffieHellman({
		privateKey: privateKeyObject(privateKey),
		publicKey: publicKeyObject(publicKey),
	})
}

function sealKey(shared: Buffer, ephemeralPublicKey: Buffer, recipientPublicKey: Buffer): Buffer {
	return hkdf(shared, SEAL_INFO, Buffer.concat([ephemeralPublicKey, recipientPublicKey]))
}

export function sealVaultKey(vek: Uint8Array, recipientPublicKey: Uint8Array): Buffer {
	const recipient = assertKeyLength(Buffer.from(recipientPublicKey), "public key")
	const ephemeral = generateX25519KeyPair()
	const key = sealKey(sharedSecret(ephemeral.privateKey, recipient), ephemeral.publicKey, recipient)
	return Buffer.concat([Buffer.from([SEALED_KEY_VERSION]), ephemeral.publicKey, encrypt(vek, key)])
}

export function openSealedVaultKey(sealed: Uint8Array, privateKey: Uint8Array): Buffer {
	const blob = Buffer.from(sealed)
	if (blob.length <= 1 + X25519_KEY_LENGTH || blob[0] !== SEALED_KEY_VERSION) {
		throw new Error("Unsupported vault key format")
	}
	const ephemeralPublicKey = blob.subarray(1, 1 + X25519_KEY_LENGTH)
	const recipient = x25519PublicKey(privateKey)
	const key = sealKey(sharedSecret(privateKey, ephemeralPublicKey), ephemeralPublicKey, recipient)
	return decrypt(blob.subarray(1 + X25519_KEY_LENGTH), key)
}

export function keyFingerprint(publicKey: Uint8Array): string {
	const digest = createHash("sha256").update(publicKey).digest("hex").slice(0, 24).toUpperCase()
	return digest.match(/.{4}/g)?.join(" ") ?? digest
}

export function encodeRecoveryKey(bytes: Uint8Array): string {
	let bits = 0
	let value = 0
	let output = ""
	for (const byte of bytes) {
		value = (value << 8) | byte
		bits += 8
		while (bits >= 5) {
			output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31]
			bits -= 5
		}
	}
	if (bits > 0) output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31]
	return output.match(/.{1,4}/g)?.join("-") ?? output
}

export function parseRecoveryKey(text: string): Buffer {
	const normalized = text
		.toUpperCase()
		.replace(/[\s-]/g, "")
		.replace(/[ILO]/g, (letter) => CROCKFORD_ALIASES[letter] ?? letter)
	const bytes: number[] = []
	let bits = 0
	let value = 0
	for (const character of normalized) {
		const index = CROCKFORD_ALPHABET.indexOf(character)
		if (index < 0) throw new Error("Invalid recovery key")
		value = ((value << 5) | index) & 0xffff
		bits += 5
		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 0xff)
			bits -= 8
		}
	}
	if (bytes.length !== RECOVERY_KEY_LENGTH) throw new Error("Invalid recovery key")
	return Buffer.from(bytes)
}

export function generateRecoveryKey(): Buffer {
	return randomBytes(RECOVERY_KEY_LENGTH)
}

export function wrapWithRecoveryKey(privateKey: Uint8Array, recoveryKey: Uint8Array): Buffer {
	return encrypt(privateKey, hkdf(recoveryKey, RECOVERY_INFO))
}

export function unwrapWithRecoveryKey(wrapped: Uint8Array, recoveryKey: Uint8Array): Buffer {
	return assertKeyLength(decrypt(wrapped, hkdf(recoveryKey, RECOVERY_INFO)), "private key")
}
