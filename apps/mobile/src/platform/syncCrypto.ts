import type { CryptoPrimitives } from "@cortex/platform"
import { gcm } from "@noble/ciphers/aes.js"
import { x25519 } from "@noble/curves/ed25519"
import { hkdf } from "@noble/hashes/hkdf"
import { sha256 } from "@noble/hashes/sha2"
import * as ExpoCrypto from "expo-crypto"
import { gunzipSync, gzipSync } from "fflate"

import { CortexNative } from "../../modules/cortex-native"
import { deriveArgon2id } from "./kdfBridge"

const GCM_TAG_LENGTH = 16

function randomBytes(length: number): Uint8Array {
	return ExpoCrypto.getRandomValues(new Uint8Array(length))
}

type NativeCrypto = NonNullable<typeof CortexNative>

const jsCrypto: CryptoPrimitives = {
	randomBytes,
	aes256GcmEncrypt: (key, nonce, plaintext) => {
		const sealed = gcm(key, nonce).encrypt(plaintext)
		const split = sealed.length - GCM_TAG_LENGTH
		return { ciphertext: sealed.slice(0, split), tag: sealed.slice(split) }
	},
	aes256GcmDecrypt: (key, nonce, ciphertext, tag) => {
		const sealed = new Uint8Array(ciphertext.length + tag.length)
		sealed.set(ciphertext)
		sealed.set(tag, ciphertext.length)
		return gcm(key, nonce).decrypt(sealed)
	},
	hkdfSha256: (ikm, salt, info, length) => hkdf(sha256, ikm, salt, info, length),
	x25519GenerateKeyPair: () => {
		const privateKey = randomBytes(32)
		return { privateKey, publicKey: x25519.getPublicKey(privateKey) }
	},
	x25519PublicKey: (privateKey) => x25519.getPublicKey(privateKey),
	x25519SharedSecret: (privateKey, publicKey) => x25519.getSharedSecret(privateKey, publicKey),
	sha256: (data) => sha256(data),
	argon2id: (password, { salt, memoryCost, timeCost, parallelism, hashLength }) =>
		deriveArgon2id(password, salt, { hashLength, memoryCost, parallelism, timeCost }),
	gzip: async (data) => gzipSync(data),
	gunzip: async (data) => gunzipSync(data),
}

function createNativeCrypto(native: NativeCrypto): CryptoPrimitives {
	return {
		...jsCrypto,
		aes256GcmEncrypt: (key, nonce, plaintext) => {
			const sealed = native.aes256GcmSeal(key, nonce, plaintext)
			const split = sealed.length - GCM_TAG_LENGTH
			return { ciphertext: sealed.subarray(0, split), tag: sealed.subarray(split) }
		},
		aes256GcmDecrypt: (key, nonce, ciphertext, tag) =>
			native.aes256GcmOpen(key, nonce, ciphertext, tag),
		hkdfSha256: (ikm, salt, info, length) => native.hkdfSha256(ikm, salt, info, length),
		x25519GenerateKeyPair: () => {
			const privateKey = randomBytes(32)
			return { privateKey, publicKey: native.x25519PublicKey(privateKey) }
		},
		x25519PublicKey: (privateKey) => native.x25519PublicKey(privateKey),
		x25519SharedSecret: (privateKey, publicKey) => native.x25519SharedSecret(privateKey, publicKey),
		sha256: (data) => native.sha256(data),
		argon2id: (password, { salt, memoryCost, timeCost, parallelism, hashLength }) =>
			native.argon2id(password, salt, memoryCost, timeCost, parallelism, hashLength),
	}
}

export const hasNativeCrypto = CortexNative !== null

export const mobileCrypto: CryptoPrimitives = CortexNative
	? createNativeCrypto(CortexNative)
	: jsCrypto
