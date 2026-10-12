import type { InviteKeyLink, SecretStore } from "@cortex/sync-api"
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
		encryptedVaultKey: encrypt(decodeVek(encoded), linkKey).toString("base64"),
		linkKey: linkKey.toString("base64url"),
	}
}

export function storeInviteKey(
	secrets: SecretStore,
	vaultId: string,
	encryptedVaultKey: string,
	linkKey: string,
): void {
	const key = Buffer.from(linkKey, "base64url")
	let vek: Buffer
	try {
		vek = assertVaultKey(decrypt(Buffer.from(encryptedVaultKey, "base64"), key))
	} catch {
		throw new Error("This invite link's key does not match. Ask for a new link.")
	}
	secrets.set(vekSecretKey(vaultId), encodeVek(vek))
}
