import { gcm } from "@noble/ciphers/aes.js"
import { randomBytes } from "@noble/ciphers/utils.js"
import { hkdf } from "@noble/hashes/hkdf"
import { sha256 } from "@noble/hashes/sha2"
import { utf8ToBytes } from "@noble/hashes/utils"

export const COLLAB_KEY_INFO = "cortex/collab/v1"
export const COLLAB_ENVELOPE_VERSION = 0x01
export const COLLAB_NONCE_BYTES = 12
export const COLLAB_TAG_BYTES = 16
export const COLLAB_ENVELOPE_OVERHEAD = 1 + COLLAB_NONCE_BYTES + COLLAB_TAG_BYTES

export function deriveCollabKey(vaultKey: Uint8Array): Uint8Array {
	return hkdf(sha256, vaultKey, undefined, utf8ToBytes(COLLAB_KEY_INFO), 32)
}

function collabAad(vaultId: string): Uint8Array {
	return utf8ToBytes(`${COLLAB_KEY_INFO}:${vaultId}`)
}

export function sealCollabPayload(
	key: Uint8Array,
	vaultId: string,
	plaintext: Uint8Array,
): Uint8Array {
	const nonce = randomBytes(COLLAB_NONCE_BYTES)
	const ciphertext = gcm(key, nonce, collabAad(vaultId)).encrypt(plaintext)
	const envelope = new Uint8Array(1 + COLLAB_NONCE_BYTES + ciphertext.length)
	envelope[0] = COLLAB_ENVELOPE_VERSION
	envelope.set(nonce, 1)
	envelope.set(ciphertext, 1 + COLLAB_NONCE_BYTES)
	return envelope
}

export function openCollabPayload(
	key: Uint8Array,
	vaultId: string,
	envelope: Uint8Array,
): Uint8Array {
	if (envelope.length < COLLAB_ENVELOPE_OVERHEAD || envelope[0] !== COLLAB_ENVELOPE_VERSION) {
		throw new Error("Unsupported collab envelope")
	}
	const nonce = envelope.subarray(1, 1 + COLLAB_NONCE_BYTES)
	return gcm(key, nonce, collabAad(vaultId)).decrypt(envelope.subarray(1 + COLLAB_NONCE_BYTES))
}
