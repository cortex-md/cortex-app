import type { Keychain as IKeychain } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Keychain implements IKeychain {
	async get(key: string): Promise<string | null> {
		return await invoke<string | null>("keychain_get", { key })
	}

	async set(key: string, value: string): Promise<void> {
		await invoke<void>("keychain_set", { key, value })
	}

	async delete(key: string): Promise<void> {
		await invoke<void>("keychain_delete", { key })
	}
}
