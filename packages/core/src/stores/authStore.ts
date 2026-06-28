import type { AuthStatus, CurrentUser } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { DEFAULT_SYNC_SERVER_URL, normalizeServerUrl } from "../sync/serverConfig"
import { setAuthStatusRefresher } from "./authSession"

const SERVER_URL_KEYCHAIN_KEY = "server_url"

export interface AuthState {
	authenticated: boolean
	user: CurrentUser | null
	loading: boolean
	error: string | null
	serverUrl: string

	checkAuth: (serverUrl?: string) => Promise<void>
	loadPreferences: () => Promise<void>
	login: (email: string, password: string, serverUrl?: string) => Promise<void>
	register: (
		email: string,
		password: string,
		displayName: string,
		serverUrl?: string,
	) => Promise<void>
	logout: (allDevices?: boolean, serverUrl?: string) => Promise<void>
	clearError: () => void
}

function resolveServerUrl(serverUrl: string | undefined, current: string): string {
	return normalizeServerUrl(serverUrl || current || DEFAULT_SYNC_SERVER_URL)
}

function applyAuthStatus(state: AuthState, status: AuthStatus, serverUrl: string): void {
	state.serverUrl = serverUrl
	state.authenticated = status.authenticated
	state.user =
		status.authenticated && status.userId && status.email
			? {
					userId: status.userId,
					email: status.email,
					displayName: status.displayName,
				}
			: null
	state.loading = false
}

function createCurrentUser(status: AuthStatus): CurrentUser | null {
	return status.authenticated && status.userId && status.email
		? {
				userId: status.userId,
				email: status.email,
				displayName: status.displayName,
			}
		: null
}

export const useAuthStore = create<AuthState>()(
	devtools(
		immer((set, get) => ({
			authenticated: false,
			user: null,
			loading: false,
			error: null,
			serverUrl: DEFAULT_SYNC_SERVER_URL,

			checkAuth: async (serverUrl) => {
				const resolvedServerUrl = resolveServerUrl(serverUrl, get().serverUrl)
				try {
					const platform = getPlatform()
					const status: AuthStatus = await platform.auth.getStatus(resolvedServerUrl)
					set((state) => {
						applyAuthStatus(state as AuthState, status, resolvedServerUrl)
					})
				} catch {
					set((state) => {
						state.serverUrl = resolvedServerUrl
						state.authenticated = false
						state.user = null
						state.loading = false
					})
				}
			},

			loadPreferences: async () => {
				try {
					const platform = getPlatform()
					const storedUrl = await platform.keychain.get(SERVER_URL_KEYCHAIN_KEY)
					set((state) => {
						if (storedUrl) state.serverUrl = resolveServerUrl(storedUrl, DEFAULT_SYNC_SERVER_URL)
					})
				} catch {}
			},

			login: async (email, password, serverUrl) => {
				const resolvedServerUrl = resolveServerUrl(serverUrl, get().serverUrl)
				set((state) => {
					state.loading = true
					state.error = null
					state.serverUrl = resolvedServerUrl
				})
				try {
					const platform = getPlatform()
					const result = await platform.auth.login(resolvedServerUrl, email, password)
					set((state) => {
						state.authenticated = true
						state.user = {
							userId: result.userId,
							email: result.email,
							displayName: result.displayName,
						}
						state.loading = false
					})
				} catch (e) {
					set((state) => {
						state.loading = false
						state.error = String(e)
					})
					throw e
				}
			},

			register: async (email, password, displayName, serverUrl) => {
				const resolvedServerUrl = resolveServerUrl(serverUrl, get().serverUrl)
				set((state) => {
					state.loading = true
					state.error = null
					state.serverUrl = resolvedServerUrl
				})
				try {
					const platform = getPlatform()
					const result = await platform.auth.register(
						resolvedServerUrl,
						email,
						password,
						displayName,
					)
					await get().login(email, password, resolvedServerUrl)
					set((state) => {
						if (state.user) state.user.displayName = result.displayName
					})
				} catch (e) {
					set((state) => {
						state.loading = false
						state.error = String(e)
					})
					throw e
				}
			},

			logout: async (allDevices = false, serverUrl) => {
				const resolvedServerUrl = resolveServerUrl(serverUrl, get().serverUrl)
				try {
					const { useSyncStore } = await import("./syncStore")
					await useSyncStore.getState().stopSync()
				} catch (error) {
					console.error("[Auth logout sync stop failed]", { error })
				}
				try {
					const [{ useRemoteVaultStore }, { useVaultStore }] = await Promise.all([
						import("./remoteVaultStore"),
						import("./vaultStore"),
					])
					const vaultPath = useVaultStore.getState().vault?.path
					const remoteVaultState = useRemoteVaultStore.getState()
					if (vaultPath && remoteVaultState.syncConfig.enabled) {
						await remoteVaultState.setSyncEnabled(vaultPath, false)
					}
				} catch (error) {
					console.error("[Auth logout sync disable failed]", { error })
				}
				try {
					const platform = getPlatform()
					await platform.auth.logout(resolvedServerUrl, allDevices)
				} catch (error) {
					console.error("[Auth logout remote session failed]", { error })
				} finally {
					set((state) => {
						state.serverUrl = resolvedServerUrl
						state.authenticated = false
						state.user = null
						state.error = null
					})
				}
			},

			clearError: () =>
				set((state) => {
					state.error = null
				}),
		})),
		{ name: "authStore" },
	),
)

setAuthStatusRefresher(async (serverUrl) => {
	try {
		const status: AuthStatus = await getPlatform().auth.getStatus(serverUrl)
		useAuthStore.setState({
			serverUrl,
			authenticated: status.authenticated,
			user: createCurrentUser(status),
			loading: false,
		})
		return status
	} catch {
		useAuthStore.setState({
			serverUrl,
			authenticated: false,
			user: null,
			loading: false,
		})
		return {
			authenticated: false,
			userId: null,
			email: null,
			displayName: null,
		}
	}
})
