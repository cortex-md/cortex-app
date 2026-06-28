import type {
	AuthStatus,
	CurrentUser,
	Auth as IAuth,
	LoginResult,
	RegisterResult,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Auth implements IAuth {
	async login(serverUrl: string, email: string, password: string): Promise<LoginResult> {
		return await invoke<LoginResult>("auth_login", { serverUrl, email, password })
	}

	async register(
		serverUrl: string,
		email: string,
		password: string,
		displayName: string,
	): Promise<RegisterResult> {
		return await invoke<RegisterResult>("auth_register", {
			serverUrl,
			email,
			password,
			displayName,
		})
	}

	async logout(serverUrl: string, allDevices: boolean): Promise<void> {
		await invoke<void>("auth_logout", { serverUrl, allDevices })
	}

	async getStatus(serverUrl?: string): Promise<AuthStatus> {
		return await invoke<AuthStatus>("auth_get_status", { serverUrl: serverUrl ?? null })
	}

	async getCurrentUser(serverUrl?: string): Promise<CurrentUser | null> {
		return await invoke<CurrentUser | null>("auth_get_current_user", {
			serverUrl: serverUrl ?? null,
		})
	}
}
