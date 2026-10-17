import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync,
	type KeyObject,
	randomBytes,
} from "node:crypto"
import { promisify } from "node:util"
import { gunzip, gzip } from "node:zlib"
import type { CryptoPrimitives } from "@cortex/platform"
import { argon2idAsync } from "@noble/hashes/argon2"

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)
const PKCS8_X25519_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex")
const SPKI_X25519_PREFIX = Buffer.from("302a300506032b656e032100", "hex")

function privateKeyObject(privateKey: Uint8Array): KeyObject {
	return createPrivateKey({
		key: Buffer.concat([PKCS8_X25519_PREFIX, Buffer.from(privateKey)]),
		format: "der",
		type: "pkcs8",
	})
}

function publicKeyObject(publicKey: Uint8Array): KeyObject {
	return createPublicKey({
		key: Buffer.concat([SPKI_X25519_PREFIX, Buffer.from(publicKey)]),
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

export const nodeCrypto: CryptoPrimitives = {
	randomBytes: (length) => randomBytes(length),
	aes256GcmEncrypt: (key, nonce, plaintext) => {
		const cipher = createCipheriv("aes-256-gcm", key, nonce)
		const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
		return { ciphertext, tag: cipher.getAuthTag() }
	},
	aes256GcmDecrypt: (key, nonce, ciphertext, tag) => {
		const decipher = createDecipheriv("aes-256-gcm", key, nonce)
		decipher.setAuthTag(tag)
		return Buffer.concat([decipher.update(ciphertext), decipher.final()])
	},
	hkdfSha256: (ikm, salt, info, length) => Buffer.from(hkdfSync("sha256", ikm, salt, info, length)),
	x25519GenerateKeyPair: () => {
		const { publicKey, privateKey } = generateKeyPairSync("x25519")
		return { publicKey: rawPublicKey(publicKey), privateKey: rawPrivateKey(privateKey) }
	},
	x25519PublicKey: (privateKey) => rawPublicKey(createPublicKey(privateKeyObject(privateKey))),
	x25519SharedSecret: (privateKey, publicKey) =>
		diffieHellman({
			privateKey: privateKeyObject(privateKey),
			publicKey: publicKeyObject(publicKey),
		}),
	sha256: (data) => createHash("sha256").update(data).digest(),
	argon2id: (password, { salt, memoryCost, timeCost, parallelism, hashLength }) =>
		argon2idAsync(password, salt, {
			m: memoryCost,
			t: timeCost,
			p: parallelism,
			dkLen: hashLength,
		}),
	gzip: (data) => gzipAsync(data),
	gunzip: (data) => gunzipAsync(data),
}
