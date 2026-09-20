import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { hash as argon2Hash } from "argon2"

export function generateVek(): Buffer {
	return randomBytes(32)
}

export function generateSalt(): Buffer {
	return randomBytes(16)
}

export async function deriveKeyFromPassword(password: string, salt: Buffer): Promise<Buffer> {
	const hash = await argon2Hash(password, {
		type: 2,
		memoryCost: 19456,
		timeCost: 2,
		parallelism: 1,
		hashLength: 32,
		salt,
		raw: true,
	})
	return Buffer.from(hash)
}

export function encrypt(plaintext: Buffer, key: Buffer): Buffer {
	const iv = randomBytes(12)
	const cipher = createCipheriv("aes-256-gcm", key, iv)
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
	const tag = cipher.getAuthTag()
	return Buffer.concat([iv, encrypted, tag])
}

export function decrypt(blob: Buffer, key: Buffer): Buffer {
	if (blob.length < 28) throw new Error("Ciphertext too short")
	const iv = blob.subarray(0, 12)
	const tag = blob.subarray(blob.length - 16)
	const ciphertext = blob.subarray(12, blob.length - 16)
	const decipher = createDecipheriv("aes-256-gcm", key, iv)
	decipher.setAuthTag(tag)
	return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function encryptVek(vek: Buffer, derivedKey: Buffer): Buffer {
	return encrypt(vek, derivedKey)
}

export function decryptVek(encrypted: Buffer, derivedKey: Buffer): Buffer {
	const decrypted = decrypt(encrypted, derivedKey)
	if (decrypted.length !== 32) throw new Error("Invalid VEK length after decryption")
	return decrypted
}

const VEK_PREFIX = "vek_"

export interface VekKeychain {
	get(account: string): string | null
	set(account: string, value: string): void
}

export function storeVek(keychain: VekKeychain, vaultId: string, vek: Buffer): void {
	keychain.set(`${VEK_PREFIX}${vaultId}`, vek.toString("base64"))
}

export function loadVek(keychain: VekKeychain, vaultId: string): Buffer | null {
	const encoded = keychain.get(`${VEK_PREFIX}${vaultId}`)
	if (!encoded) return null
	const bytes = Buffer.from(encoded, "base64")
	if (bytes.length !== 32) throw new Error("Invalid VEK length")
	return bytes
}
