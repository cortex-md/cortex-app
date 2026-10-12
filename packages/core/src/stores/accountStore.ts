import type {
	AccountDevice,
	AccountProfile,
	EmailChangeResult,
	KeySetupResult,
	KeyStatus,
	ProfileUpdate,
	ServerCapabilities,
} from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { resolveSyncServerUrl } from "../sync/serverConfig"
import { refreshAuthStatus } from "./authSession"
import { useRemoteVaultStore } from "./remoteVaultStore"

export interface AccountState {
	profile: AccountProfile | null
	devices: AccountDevice[]
	capabilities: Record<string, ServerCapabilities>
	keyStatus: KeyStatus | null
	loading: boolean
	error: string | null

	ensureCapabilities: (serverUrl?: string) => Promise<ServerCapabilities | null>
	fetchOverview: () => Promise<void>
	updateProfile: (update: ProfileUpdate) => Promise<void>
	changePassword: (currentPassword: string, newPassword: string) => Promise<void>
	requestEmailChange: (password: string, newEmail: string) => Promise<EmailChangeResult>
	resendEmailVerification: () => Promise<void>
	setAvatar: (image: Uint8Array, contentType: string) => Promise<void>
	deleteAvatar: () => Promise<void>
	loadKeyStatus: () => Promise<KeyStatus | null>
	setupKeys: (password: string) => Promise<KeySetupResult>
	regenerateRecoveryKey: () => Promise<string>
	clearError: () => void
}

const capabilityLoads = new Map<string, Promise<ServerCapabilities | null>>()

function activeServerUrl(): string {
	return resolveSyncServerUrl(useRemoteVaultStore.getState().syncConfig)
}

async function withSession<T>(task: () => Promise<T>): Promise<T> {
	await refreshAuthStatus(activeServerUrl())
	return await task()
}

export const useAccountStore = create<AccountState>()(
	devtools(
		immer((set, get) => {
			const run = async <T>(task: () => Promise<T>): Promise<T> => {
				set((state) => {
					state.error = null
				})
				try {
					return await withSession(task)
				} catch (error) {
					set((state) => {
						state.error = error instanceof Error ? error.message : String(error)
					})
					throw error
				}
			}

			return {
				profile: null,
				devices: [],
				capabilities: {},
				keyStatus: null,
				loading: false,
				error: null,

				ensureCapabilities: (serverUrl) => {
					const url = serverUrl ?? activeServerUrl()
					const cached = get().capabilities[url]
					if (cached) return Promise.resolve(cached)
					const existing = capabilityLoads.get(url)
					if (existing) return existing
					const load = getPlatform()
						.account.getCapabilities(url)
						.then((capabilities) => {
							set((state) => {
								state.capabilities[url] = capabilities
							})
							return capabilities
						})
						.catch(() => null)
						.finally(() => capabilityLoads.delete(url))
					capabilityLoads.set(url, load)
					return load
				},

				fetchOverview: async () => {
					set((state) => {
						state.loading = true
					})
					try {
						const overview = await run(() => getPlatform().account.getOverview())
						set((state) => {
							state.profile = overview.account
							state.devices = overview.devices
						})
					} finally {
						set((state) => {
							state.loading = false
						})
					}
				},

				updateProfile: async (update) => {
					const profile = await run(() => getPlatform().account.updateProfile(update))
					set((state) => {
						state.profile = profile
					})
				},

				changePassword: async (currentPassword, newPassword) => {
					await run(() => getPlatform().account.changePassword(currentPassword, newPassword))
				},

				requestEmailChange: async (password, newEmail) => {
					const result = await run(() =>
						getPlatform().account.requestEmailChange(password, newEmail),
					)
					if (result.applied) await get().fetchOverview()
					return result
				},

				resendEmailVerification: async () => {
					await run(() => getPlatform().account.resendEmailVerification())
				},

				setAvatar: async (image, contentType) => {
					const profile = await run(() => getPlatform().account.setAvatar(image, contentType))
					set((state) => {
						state.profile = profile
					})
				},

				deleteAvatar: async () => {
					await run(() => getPlatform().account.deleteAvatar())
					set((state) => {
						if (state.profile) state.profile.avatarUrl = null
					})
				},

				loadKeyStatus: async () => {
					try {
						const keyStatus = await withSession(() => getPlatform().account.getKeyStatus())
						set((state) => {
							state.keyStatus = keyStatus
						})
						return keyStatus
					} catch {
						return null
					}
				},

				setupKeys: async (password) => {
					const result = await run(() => getPlatform().account.setupKeys(password))
					await get().loadKeyStatus()
					return result
				},

				regenerateRecoveryKey: async () => {
					const recoveryKey = await run(() => getPlatform().account.regenerateRecoveryKey())
					set((state) => {
						if (state.keyStatus) state.keyStatus.hasRecoveryKey = true
					})
					return recoveryKey
				},

				clearError: () =>
					set((state) => {
						state.error = null
					}),
			}
		}),
		{ name: "accountStore" },
	),
)

export function useServerCapabilities(): ServerCapabilities | null {
	const serverUrl = useRemoteVaultStore((state) => resolveSyncServerUrl(state.syncConfig))
	return useAccountStore((state) => state.capabilities[serverUrl] ?? null)
}
