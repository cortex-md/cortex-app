import type { VaultKeyRequestResult } from "@cortex/platform"
import {
	type AccountIdentity,
	type ApiClient,
	getMyVaultKey,
	getVaultEncryption,
	putMyVaultKey,
	type SecretStore,
} from "@cortex/sync-api"
import { bytesEqual, fromBase64, toBase64 } from "./bytes"
import { assertVaultKey, decodeVek, decrypt, encodeVek, generateKey, vekSecretKey } from "./crypto"
import { openSealedVaultKey, sealVaultKey } from "./keys"
import { syncRuntime } from "./runtime"

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
	const derived = await syncRuntime().crypto.argon2id(password, {
		memoryCost: 19456,
		timeCost: 2,
		parallelism: 1,
		hashLength: 32,
		salt: Uint8Array.from(salt),
	})
	return Uint8Array.from(derived)
}

function sealFor(vek: Uint8Array, identity: AccountIdentity): string {
	return toBase64(sealVaultKey(vek, fromBase64(identity.publicKey)))
}

function openWith(encryptedKey: string, identity: AccountIdentity): Uint8Array | null {
	try {
		return assertVaultKey(
			openSealedVaultKey(fromBase64(encryptedKey), fromBase64(identity.privateKey)),
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
	if (current && bytesEqual(current, vek)) return false
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
	const derivedKey = await deriveKey(password, fromBase64(record.salt))
	let vek: Uint8Array
	try {
		vek = decrypt(fromBase64(record.encryptedVek), derivedKey)
	} catch {
		throw new Error("Wrong password")
	}
	secrets.set(vekSecretKey(vaultId), encodeVek(assertVaultKey(vek)))
}

export interface VaultKeyLoaderDeps {
	secrets: SecretStore
	currentIdentity: () => Promise<AccountIdentity | null>
	client: () => Promise<ApiClient>
}

export async function loadVaultKey(
	vaultId: string,
	{ secrets, currentIdentity, client }: VaultKeyLoaderDeps,
): Promise<string | null> {
	const secretKey = vekSecretKey(vaultId)
	const identity = await currentIdentity()
	if (!secrets.get(secretKey) && identity) {
		await requestVaultKey(await client(), secrets, vaultId, identity)
	}
	const encoded = secrets.get(secretKey)
	if (encoded && identity) {
		void client()
			.then((api) => ensureOwnVaultKey(api, secrets, vaultId, identity))
			.catch((error) => console.warn("[sync] vault key self-registration failed:", error))
	}
	return encoded
}
