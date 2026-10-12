import type { Keychain } from "@cortex/platform"

export function vekSecretKey(vaultId: string): string {
	return `vek_${vaultId}`
}

export function identitySecretKey(userId: string): string {
	return `identity_${userId}`
}

export interface SecretStore {
	get(key: string): string | null
	set(key: string, value: string): void
	delete(key: string): void
	preload?(keys: readonly string[]): Promise<void>
}

export function createCachedSecretStore(keychain: Keychain): Required<SecretStore> {
	const values = new Map<string, string | null>()
	const loads = new Map<string, Promise<void>>()
	let pendingWrites: Promise<void> = Promise.resolve()

	const writeBehind = (key: string, value: string | null, write: () => Promise<void>) => {
		values.set(key, value)
		loads.set(key, Promise.resolve())
		pendingWrites = pendingWrites.then(write).catch((error: unknown) => {
			console.error(`[secrets] failed to persist ${key}:`, error)
		})
	}

	const load = (key: string): Promise<void> => {
		const existing = loads.get(key)
		if (existing) return existing
		const pending = keychain.get(key).then(
			(value) => {
				if (!values.has(key)) values.set(key, value)
			},
			(error: unknown) => {
				loads.delete(key)
				throw error
			},
		)
		loads.set(key, pending)
		return pending
	}

	return {
		get: (key) => values.get(key) ?? null,
		set: (key, value) => writeBehind(key, value, () => keychain.set(key, value)),
		delete: (key) => writeBehind(key, null, () => keychain.delete(key)),
		preload: async (keys) => {
			await Promise.all(keys.map(load))
		},
	}
}
