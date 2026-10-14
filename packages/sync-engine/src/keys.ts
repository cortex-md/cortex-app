import { concatBytes, toHex } from "./bytes"
import { decrypt, encrypt } from "./crypto"
import { syncRuntime } from "./runtime"

const X25519_KEY_LENGTH = 32
const SEALED_KEY_VERSION = 0x01
const SEAL_INFO = "cortex/vek-seal/v1"
const RECOVERY_INFO = "cortex/recovery/v1"
const RECOVERY_KEY_LENGTH = 32
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const CROCKFORD_ALIASES: Record<string, string> = { I: "1", L: "1", O: "0" }

export function hkdf(
	ikm: Uint8Array,
	info: string,
	salt: Uint8Array = new Uint8Array(0),
): Uint8Array {
	return syncRuntime().crypto.hkdfSha256(ikm, salt, info, 32)
}

function assertKeyLength(key: Uint8Array, label: string): Uint8Array {
	if (key.length !== X25519_KEY_LENGTH) throw new Error(`Invalid ${label} length`)
	return key
}

export interface X25519KeyPair {
	publicKey: Uint8Array
	privateKey: Uint8Array
}

export function generateX25519KeyPair(): X25519KeyPair {
	const { publicKey, privateKey } = syncRuntime().crypto.x25519GenerateKeyPair()
	return { publicKey, privateKey }
}

export function x25519PublicKey(privateKey: Uint8Array): Uint8Array {
	return syncRuntime().crypto.x25519PublicKey(assertKeyLength(privateKey, "private key"))
}

function sharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
	return syncRuntime().crypto.x25519SharedSecret(
		assertKeyLength(privateKey, "private key"),
		assertKeyLength(publicKey, "public key"),
	)
}

function sealKey(
	shared: Uint8Array,
	ephemeralPublicKey: Uint8Array,
	recipientPublicKey: Uint8Array,
): Uint8Array {
	return hkdf(shared, SEAL_INFO, concatBytes([ephemeralPublicKey, recipientPublicKey]))
}

export function sealVaultKey(vek: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
	const recipient = assertKeyLength(Uint8Array.from(recipientPublicKey), "public key")
	const ephemeral = generateX25519KeyPair()
	const key = sealKey(sharedSecret(ephemeral.privateKey, recipient), ephemeral.publicKey, recipient)
	return concatBytes([Uint8Array.of(SEALED_KEY_VERSION), ephemeral.publicKey, encrypt(vek, key)])
}

export function openSealedVaultKey(sealed: Uint8Array, privateKey: Uint8Array): Uint8Array {
	const blob = Uint8Array.from(sealed)
	if (blob.length <= 1 + X25519_KEY_LENGTH || blob[0] !== SEALED_KEY_VERSION) {
		throw new Error("Unsupported vault key format")
	}
	const ephemeralPublicKey = blob.subarray(1, 1 + X25519_KEY_LENGTH)
	const recipient = x25519PublicKey(privateKey)
	const key = sealKey(sharedSecret(privateKey, ephemeralPublicKey), ephemeralPublicKey, recipient)
	return decrypt(blob.subarray(1 + X25519_KEY_LENGTH), key)
}

export function keyFingerprint(publicKey: Uint8Array): string {
	const digest = toHex(syncRuntime().crypto.sha256(publicKey)).slice(0, 24).toUpperCase()
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

export function parseRecoveryKey(text: string): Uint8Array {
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
	return Uint8Array.from(bytes)
}

export function generateRecoveryKey(): Uint8Array {
	return syncRuntime().crypto.randomBytes(RECOVERY_KEY_LENGTH)
}

export function wrapWithRecoveryKey(privateKey: Uint8Array, recoveryKey: Uint8Array): Uint8Array {
	return encrypt(privateKey, hkdf(recoveryKey, RECOVERY_INFO))
}

export function unwrapWithRecoveryKey(wrapped: Uint8Array, recoveryKey: Uint8Array): Uint8Array {
	return assertKeyLength(decrypt(wrapped, hkdf(recoveryKey, RECOVERY_INFO)), "private key")
}
