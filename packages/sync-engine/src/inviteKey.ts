import type { InviteKeyLink, SecretStore } from "@cortex/sync-api"
import { fromBase64, fromBase64Url, toBase64, toBase64Url } from "./bytes"
import {
	assertVaultKey,
	decodeVek,
	decrypt,
	encodeVek,
	encrypt,
	generateKey,
	vekSecretKey,
} from "./crypto"

export function createInviteKeyLink(secrets: SecretStore, vaultId: string): InviteKeyLink | null {
	const encoded = secrets.get(vekSecretKey(vaultId))
	if (!encoded) return null
	const linkKey = generateKey()
	return {
		encryptedVaultKey: toBase64(encrypt(decodeVek(encoded), linkKey)),
		linkKey: toBase64Url(linkKey),
	}
}

export function storeInviteKey(
	secrets: SecretStore,
	vaultId: string,
	encryptedVaultKey: string,
	linkKey: string,
): void {
	const key = fromBase64Url(linkKey)
	let vek: Uint8Array
	try {
		vek = assertVaultKey(decrypt(fromBase64(encryptedVaultKey), key))
	} catch {
		throw new Error("This invite link's key does not match. Ask for a new link.")
	}
	secrets.set(vekSecretKey(vaultId), encodeVek(vek))
}
