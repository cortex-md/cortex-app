import type { Keychain, Platform } from "@cortex/platform"
import { createCachedSecretStore } from "@cortex/sync-api"
import * as SecureStore from "expo-secure-store"

export function toSecureStoreKey(key: string): string {
	return key.replace(
		/[^A-Za-z0-9.-]/gu,
		(character) => `_${(character.codePointAt(0) ?? 0).toString(16).padStart(6, "0")}`,
	)
}

const secureStoreKeychain: Keychain = {
	delete: (key) => SecureStore.deleteItemAsync(toSecureStoreKey(key)),
	get: (key) => SecureStore.getItemAsync(toSecureStoreKey(key)),
	set: (key, value) => SecureStore.setItemAsync(toSecureStoreKey(key), value),
}

export const secrets = createCachedSecretStore(secureStoreKeychain)

export const keychainApi = {
	get: async (key) => {
		await secrets.preload([key])
		return secrets.get(key)
	},
	set: async (key, value) => secrets.set(key, value),
	delete: async (key) => secrets.delete(key),
} satisfies Platform["keychain"]
