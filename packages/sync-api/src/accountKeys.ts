import type { KeySetupResult, KeyStatus } from "@cortex/platform"
import {
	type AccountKeys,
	changeAccountPassword,
	getAccountKeys,
	preparePasswordReset,
	resetAccountPassword,
	updateAccountKeys,
	updateAccountRecovery,
} from "./account"
import type { ApiClient } from "./client"
import type { RegisterKeyMaterial } from "./endpoints"
import { identitySecretKey, type SecretStore } from "./secrets"

export const MIN_PASSWORD_LENGTH = 8

export const ACCOUNT_KDF = {
	algorithm: "argon2id",
	memoryKib: 65536,
	iterations: 3,
	parallelism: 1,
	hashLength: 32,
} as const

export const ACCOUNT_KEY_INFO = {
	auth: "cortex/auth/v1",
	wrap: "cortex/wrap/v1",
} as const

export interface DerivedAccountKeys {
	authKey: string
	wrapKey: Uint8Array
}

export interface IdentityKeyPair {
	publicKey: string
	privateKey: string
}

export interface RecoveryKeyMaterial {
	recoveryKey: string
	recoveryWrappedPrivateKey: string
}

export interface AccountKeyCrypto {
	createSalt(): string
	deriveKeys(password: string, kdfSalt: string): Promise<DerivedAccountKeys>
	generateIdentity(): IdentityKeyPair
	publicKeyOf(privateKey: string): string
	wrapPrivateKey(privateKey: string, wrapKey: Uint8Array): string
	unwrapPrivateKey(encryptedPrivateKey: string, wrapKey: Uint8Array): string
	createRecovery(privateKey: string, recoveryKey?: string): RecoveryKeyMaterial
	recoverPrivateKey(recoveryKey: string, recoveryWrappedPrivateKey: string): string
	fingerprint(publicKey: string): string
}

export interface AccountIdentity {
	userId: string
	publicKey: string
	privateKey: string
}

export interface NewAccountIdentity extends RegisterKeyMaterial {
	authKey: string
	privateKey: string
	recoveryKey: string | null
}

export function assertPasswordStrength(password: string): void {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`)
	}
}

export function hasDerivedPassword(kdfVersion: number): boolean {
	return kdfVersion >= 1
}

function unsupportedKeys(): Error {
	return new Error("This account uses end-to-end encryption keys that this app cannot open yet.")
}

export async function createAccountIdentity(
	crypto: AccountKeyCrypto,
	password: string,
	options: { privateKey?: string; recoveryKey?: string | null } = {},
): Promise<NewAccountIdentity> {
	const kdfSalt = crypto.createSalt()
	const derived = await crypto.deriveKeys(password, kdfSalt)
	const identity = options.privateKey
		? { privateKey: options.privateKey, publicKey: crypto.publicKeyOf(options.privateKey) }
		: crypto.generateIdentity()
	const recovery =
		options.recoveryKey === null
			? null
			: crypto.createRecovery(identity.privateKey, options.recoveryKey)
	return {
		kdfSalt,
		authKey: derived.authKey,
		publicKey: identity.publicKey,
		privateKey: identity.privateKey,
		encryptedPrivateKey: crypto.wrapPrivateKey(identity.privateKey, derived.wrapKey),
		recoveryWrappedPrivateKey: recovery?.recoveryWrappedPrivateKey ?? null,
		recoveryKey: recovery?.recoveryKey ?? null,
	}
}

export class AccountKeyStore {
	constructor(
		private readonly secrets: SecretStore,
		readonly crypto: AccountKeyCrypto | null,
	) {}

	requireCrypto(): AccountKeyCrypto {
		if (!this.crypto) throw unsupportedKeys()
		return this.crypto
	}

	async loadPrivateKey(userId: string): Promise<string | null> {
		const key = identitySecretKey(userId)
		await this.secrets.preload?.([key])
		return this.secrets.get(key)
	}

	storePrivateKey(userId: string, privateKey: string): void {
		if (userId) this.secrets.set(identitySecretKey(userId), privateKey)
	}

	clear(userId: string | null): void {
		if (userId) this.secrets.delete(identitySecretKey(userId))
	}

	async identity(userId: string | null): Promise<AccountIdentity | null> {
		if (!userId || !this.crypto) return null
		const privateKey = await this.loadPrivateKey(userId)
		if (!privateKey) return null
		try {
			return { userId, privateKey, publicKey: this.crypto.publicKeyOf(privateKey) }
		} catch {
			return null
		}
	}

	async derivedPassword(api: ApiClient, password: string, keys?: AccountKeys): Promise<string> {
		const current = keys ?? (await getAccountKeys(api))
		if (!hasDerivedPassword(current.kdfVersion)) return password
		if (!current.kdfSalt) throw unsupportedKeys()
		return (await this.requireCrypto().deriveKeys(password, current.kdfSalt)).authKey
	}

	unlockPrivateKey(encryptedPrivateKey: string, wrapKey: Uint8Array): string {
		try {
			return this.requireCrypto().unwrapPrivateKey(encryptedPrivateKey, wrapKey)
		} catch {
			throw new Error("Wrong password")
		}
	}

	async upgradeLegacyAccount(
		api: ApiClient,
		userId: string,
		currentPassword: string,
	): Promise<string | null> {
		const created = await createAccountIdentity(this.requireCrypto(), currentPassword)
		await updateAccountKeys(api, {
			currentPassword,
			password: created.authKey,
			kdfSalt: created.kdfSalt,
			publicKey: created.publicKey,
			encryptedPrivateKey: created.encryptedPrivateKey,
			recoveryWrappedPrivateKey: created.recoveryWrappedPrivateKey,
		})
		this.storePrivateKey(userId, created.privateKey)
		return created.recoveryKey
	}

	async keyStatus(api: ApiClient, userId: string | null): Promise<KeyStatus> {
		const keys = await getAccountKeys(api)
		const identity = await this.identity(userId)
		return {
			kdfVersion: keys.kdfVersion,
			hasPublicKey: keys.publicKey !== null,
			hasLocalIdentity:
				identity !== null && (keys.publicKey === null || identity.publicKey === keys.publicKey),
			hasRecoveryKey: keys.hasRecovery,
			fingerprint: keys.publicKey && this.crypto ? this.crypto.fingerprint(keys.publicKey) : null,
		}
	}

	async setupKeys(api: ApiClient, userId: string, password: string): Promise<KeySetupResult> {
		const keys = await getAccountKeys(api)
		if (!hasDerivedPassword(keys.kdfVersion)) {
			return { recoveryKey: await this.upgradeLegacyAccount(api, userId, password) }
		}
		if (!keys.kdfSalt || !keys.encryptedPrivateKey) throw unsupportedKeys()
		const derived = await this.requireCrypto().deriveKeys(password, keys.kdfSalt)
		this.storePrivateKey(userId, this.unlockPrivateKey(keys.encryptedPrivateKey, derived.wrapKey))
		return { recoveryKey: null }
	}

	async regenerateRecoveryKey(api: ApiClient, userId: string | null): Promise<string> {
		const identity = await this.identity(userId)
		if (!identity) throw new Error("Set up your encryption keys on this device first.")
		const recovery = this.requireCrypto().createRecovery(identity.privateKey)
		await updateAccountRecovery(api, recovery.recoveryWrappedPrivateKey)
		return recovery.recoveryKey
	}

	async changePassword(
		api: ApiClient,
		userId: string | null,
		currentPassword: string,
		newPassword: string,
	): Promise<void> {
		assertPasswordStrength(newPassword)
		const keys = await getAccountKeys(api)
		if (!hasDerivedPassword(keys.kdfVersion)) {
			await changeAccountPassword(api, currentPassword, newPassword)
			return
		}
		const crypto = this.requireCrypto()
		if (!keys.kdfSalt || !keys.encryptedPrivateKey) throw unsupportedKeys()
		const current = await crypto.deriveKeys(currentPassword, keys.kdfSalt)
		const privateKey = this.unlockPrivateKey(keys.encryptedPrivateKey, current.wrapKey)
		const kdfSalt = crypto.createSalt()
		const next = await crypto.deriveKeys(newPassword, kdfSalt)
		await changeAccountPassword(api, current.authKey, next.authKey, {
			kdfSalt,
			encryptedPrivateKey: crypto.wrapPrivateKey(privateKey, next.wrapKey),
		})
		if (userId) this.storePrivateKey(userId, privateKey)
	}

	async resetPassword(
		api: ApiClient,
		token: string,
		newPassword: string,
		recoveryKey: string | null,
	): Promise<void> {
		assertPasswordStrength(newPassword)
		if (!this.crypto) {
			await resetAccountPassword(api, { token, password: newPassword })
			return
		}
		const prepared = await preparePasswordReset(api, token)
		let privateKey: string | undefined
		if (recoveryKey?.trim() && prepared.recoveryWrappedPrivateKey) {
			try {
				privateKey = this.crypto.recoverPrivateKey(recoveryKey, prepared.recoveryWrappedPrivateKey)
			} catch {
				throw new Error("This recovery key does not match your account.")
			}
			if (prepared.publicKey && this.crypto.publicKeyOf(privateKey) !== prepared.publicKey) {
				throw new Error("This recovery key does not match your account.")
			}
		}
		const created = await createAccountIdentity(this.crypto, newPassword, {
			privateKey,
			recoveryKey: privateKey ? recoveryKey : null,
		})
		await resetAccountPassword(api, {
			token,
			password: created.authKey,
			kdfSalt: created.kdfSalt,
			publicKey: created.publicKey,
			encryptedPrivateKey: created.encryptedPrivateKey,
			recoveryWrappedPrivateKey: created.recoveryWrappedPrivateKey,
		})
	}
}
