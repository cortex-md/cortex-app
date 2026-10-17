import {
	ACCOUNT_KDF,
	ACCOUNT_KEY_INFO,
	type AccountKeyCrypto,
	type DerivedAccountKeys,
} from "@cortex/sync-api"
import { fromBase64 as decodeBase64, toBase64 as encodeBase64, toBase64Url } from "./bytes"
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
import { syncRuntime } from "./runtime"

const KDF_SALT_LENGTH = 16

export async function deriveAccountKeys(
	password: string,
	kdfSalt: Uint8Array,
): Promise<DerivedAccountKeys> {
	const master = await syncRuntime().crypto.argon2id(password, {
		memoryCost: ACCOUNT_KDF.memoryKib,
		timeCost: ACCOUNT_KDF.iterations,
		parallelism: ACCOUNT_KDF.parallelism,
		hashLength: ACCOUNT_KDF.hashLength,
		salt: Uint8Array.from(kdfSalt),
	})
	return {
		authKey: toBase64Url(hkdf(master, ACCOUNT_KEY_INFO.auth)),
		wrapKey: hkdf(master, ACCOUNT_KEY_INFO.wrap),
	}
}

const fromBase64 = (value: string) => decodeBase64(value)
const toBase64 = (value: Uint8Array) => encodeBase64(value)

export const accountKeyCrypto: AccountKeyCrypto = {
	createSalt: () => toBase64(syncRuntime().crypto.randomBytes(KDF_SALT_LENGTH)),
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
