import { createPublicKey, type KeyObject, verify } from "node:crypto"
import { UpdateError } from "./errors"

const ED25519_SIGNATURE_BYTES = 64

export function importPublicKey(spkiBase64: string): KeyObject {
	const key = createPublicKey({
		key: Buffer.from(spkiBase64, "base64"),
		format: "der",
		type: "spki",
	})
	if (key.asymmetricKeyType !== "ed25519") throw new Error("Update public key is not Ed25519")
	return key
}

export function verifyManifestSignature(
	manifestBytes: Uint8Array,
	signatureBase64: string,
	publicKey: KeyObject,
): void {
	const signature = Buffer.from(signatureBase64.trim(), "base64")
	const valid =
		signature.length === ED25519_SIGNATURE_BYTES &&
		verify(null, manifestBytes, publicKey, signature)
	if (!valid) throw new UpdateError("SIGNATURE_INVALID", "The update manifest signature is invalid")
}
