import type { VaultKeyRequestResult } from "@cortex/platform"
import {
	type AccountIdentity,
	type ApiClient,
	getMyVaultKey,
	getVaultEncryption,
	putMyVaultKey,
	type SecretStore,
} from "@cortex/sync-api"
import { argon2id, hash } from "argon2"
import { assertVaultKey, decodeVek, decrypt, encodeVek, generateKey, vekSecretKey } from "./crypto"
import { openSealedVaultKey, sealVaultKey } from "./keys"

async function deriveKey(password: string, salt: Uint8Array): Promise<Buffer> {
	const derived = await hash(password, {
		type: argon2id,
		memoryCost: 19456,
		timeCost: 2,
		parallelism: 1,
		hashLength: 32,
		salt: Buffer.from(salt),
		raw: true,
	})
	return Buffer.from(derived)
}

function sealFor(vek: Uint8Array, identity: AccountIdentity): string {
	return sealVaultKey(vek, Buffer.from(identity.publicKey, "base64")).toString("base64")
}

function openWith(encryptedKey: string, identity: AccountIdentity): Buffer | null {
	try {
		return assertVaultKey(
			openSealedVaultKey(
				Buffer.from(encryptedKey, "base64"),
				Buffer.from(identity.privateKey, "base64"),
			),
		)
	} catch {
		return null
	}
}

export async function createVaultKey(
	api: ApiClient,
	secrets: SecretStore,
	vaultId: string,
	identity: AccountIdentity,
): Promise<void> {
	const vek = generateKey()
	await putMyVaultKey(api, vaultId, sealFor(vek, identity))
	secrets.set(vekSecretKey(vaultId), encodeVek(vek))
}

export async function requestVaultKey(
	api: ApiClient,
	secrets: SecretStore,
	vaultId: string,
	identity: AccountIdentity,
): Promise<VaultKeyRequestResult> {
	const encryptedKey = await getMyVaultKey(api, vaultId)
	const vek = encryptedKey ? openWith(encryptedKey, identity) : null
	if (!vek) return "pending"
	secrets.set(vekSecretKey(vaultId), encodeVek(vek))
	return "granted"
}

export async function ensureOwnVaultKey(
	api: ApiClient,
	secrets: SecretStore,
	vaultId: string,
	identity: AccountIdentity,
): Promise<boolean> {
	const encoded = secrets.get(vekSecretKey(vaultId))
	if (!encoded) return false
	const vek = decodeVek(encoded)
	const encryptedKey = await getMyVaultKey(api, vaultId)
	const current = encryptedKey ? openWith(encryptedKey, identity) : null
	if (current?.equals(vek)) return false
	await putMyVaultKey(api, vaultId, sealFor(vek, identity))
	return true
}

export async function unlockVaultKey(
	api: ApiClient,
	secrets: SecretStore,
	vaultId: string,
	password: string,
): Promise<void> {
	const record = await getVaultEncryption(api, vaultId)
	if (!record.salt || !record.encryptedVek) {
		throw new Error("Vault has no encryption key yet. Create one first.")
	}
	const derivedKey = await deriveKey(password, Buffer.from(record.salt, "base64"))
	let vek: Buffer
	try {
		vek = decrypt(Buffer.from(record.encryptedVek, "base64"), derivedKey)
	} catch {
		throw new Error("Wrong password")
	}
	secrets.set(vekSecretKey(vaultId), encodeVek(assertVaultKey(vek)))
}
