import { randomBytes } from "node:crypto"
import type { AccountKeyCrypto, DerivedAccountKeys } from "@cortex/sync-api"
import { argon2id, hash } from "argon2"
import { decrypt, encrypt } from "./crypto"
import {
	encodeRecoveryKey,
	generateRecoveryKey,
	generateX25519KeyPair,
	hkdf,
	keyFingerprint,
	parseRecoveryKey,
	unwrapWithRecoveryKey,
	wrapWithRecoveryKey,
	x25519PublicKey,
} from "./keys"

const KDF_SALT_LENGTH = 16
const AUTH_INFO = "cortex/auth/v1"
const WRAP_INFO = "cortex/wrap/v1"

export async function deriveAccountKeys(
	password: string,
	kdfSalt: Uint8Array,
): Promise<DerivedAccountKeys> {
	const master = await hash(password, {
		type: argon2id,
		memoryCost: 65536,
		timeCost: 3,
		parallelism: 1,
		hashLength: 32,
		salt: Buffer.from(kdfSalt),
		raw: true,
	})
	return {
		authKey: hkdf(master, AUTH_INFO).toString("base64url"),
		wrapKey: hkdf(master, WRAP_INFO),
	}
}

const fromBase64 = (value: string) => Buffer.from(value, "base64")
const toBase64 = (value: Uint8Array) => Buffer.from(value).toString("base64")

export const nodeAccountKeyCrypto: AccountKeyCrypto = {
	createSalt: () => toBase64(randomBytes(KDF_SALT_LENGTH)),
	deriveKeys: (password, kdfSalt) => deriveAccountKeys(password, fromBase64(kdfSalt)),
	generateIdentity: () => {
		const pair = generateX25519KeyPair()
		return { publicKey: toBase64(pair.publicKey), privateKey: toBase64(pair.privateKey) }
	},
	publicKeyOf: (privateKey) => toBase64(x25519PublicKey(fromBase64(privateKey))),
	wrapPrivateKey: (privateKey, wrapKey) => toBase64(encrypt(fromBase64(privateKey), wrapKey)),
	unwrapPrivateKey: (encryptedPrivateKey, wrapKey) =>
		toBase64(decrypt(fromBase64(encryptedPrivateKey), wrapKey)),
	createRecovery: (privateKey, recoveryKey) => {
		const bytes = recoveryKey ? parseRecoveryKey(recoveryKey) : generateRecoveryKey()
		return {
			recoveryKey: encodeRecoveryKey(bytes),
			recoveryWrappedPrivateKey: toBase64(wrapWithRecoveryKey(fromBase64(privateKey), bytes)),
		}
	},
	recoverPrivateKey: (recoveryKey, recoveryWrappedPrivateKey) =>
		toBase64(
			unwrapWithRecoveryKey(fromBase64(recoveryWrappedPrivateKey), parseRecoveryKey(recoveryKey)),
		),
	fingerprint: (publicKey) => keyFingerprint(fromBase64(publicKey)),
}
