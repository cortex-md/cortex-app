import type { RemoteVaultInfo, SyncConfig } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	normalizeServerUrl,
	requiresCloudEntitlement,
	resolveSyncServerUrl,
} from "../sync/serverConfig"
import { refreshAuthStatus } from "./authSession"
import { useSubscriptionStore } from "./subscriptionStore"

export { DEFAULT_SYNC_SERVER_URL } from "../sync/serverConfig"

export function createDefaultSyncConfig(): SyncConfig {
	return {
		enabled: false,
		remoteVaultId: null,
		selfHosted: false,
		serverUrl: DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
		offlineMode: false,
		selfHostedEnvironment: {},
	}
}

export function normalizeSyncConfig(config: Partial<SyncConfig>): SyncConfig {
	return {
		...createDefaultSyncConfig(),
		enabled: config.enabled ?? false,
		remoteVaultId: config.remoteVaultId ?? null,
		selfHosted: config.selfHosted ?? false,
		serverUrl: config.serverUrl?.trim() || DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
		offlineMode: config.offlineMode ?? false,
		selfHostedEnvironment:
			config.selfHostedEnvironment && typeof config.selfHostedEnvironment === "object"
				? config.selfHostedEnvironment
				: {},
	}
}

export interface RemoteVaultState {
	remoteVaults: RemoteVaultInfo[]
	linkedVaultId: string | null
	syncConfig: SyncConfig
	loading: boolean
	error: string | null

	fetchRemoteVaults: () => Promise<void>
	createRemoteVault: (name: string, description: string | null) => Promise<RemoteVaultInfo>
	updateRemoteVault: (
		vaultId: string,
		name: string | null,
		description: string | null,
	) => Promise<void>
	deleteRemoteVault: (vaultId: string) => Promise<void>
	linkVault: (vaultPath: string, remoteVaultId: string) => Promise<void>
	unlinkVault: (vaultPath: string) => Promise<void>
	loadLink: (vaultPath: string) => Promise<void>
	updateSyncConfigValue: <K extends keyof SyncConfig>(
		vaultPath: string,
		key: K,
		value: SyncConfig[K],
	) => Promise<void>
	setSyncEnabled: (vaultPath: string, enabled: boolean) => Promise<void>
	setSelfHosted: (vaultPath: string, selfHosted: boolean) => Promise<void>
	saveServerUrl: (vaultPath: string, serverUrl: string) => Promise<void>
	updateSelfHostedEnvironment: (
		vaultPath: string,
		key: string,
		value: string | null,
	) => Promise<void>
	clearLink: () => void
	clearError: () => void
}

async function syncAuthContext(serverUrl: string): Promise<void> {
	await refreshAuthStatus(serverUrl)
}

async function ensureRemoteMutationAllowed(config: SyncConfig): Promise<void> {
	if (!requiresCloudEntitlement(config)) return
	await useSubscriptionStore.getState().ensureCloudEntitlement(resolveSyncServerUrl(config))
}

async function prepareRemoteMutation(config: SyncConfig): Promise<void> {
	await Promise.all([
		ensureRemoteMutationAllowed(config),
		syncAuthContext(resolveSyncServerUrl(config)),
	])
}

export const useRemoteVaultStore = create<RemoteVaultState>()(
	devtools(
		immer((set, get) => ({
			remoteVaults: [],
			linkedVaultId: null,
			syncConfig: createDefaultSyncConfig(),
			loading: false,
			error: null,

			fetchRemoteVaults: async () => {
				set((state) => {
					state.loading = true
					state.error = null
				})
				try {
					const platform = getPlatform()
					await syncAuthContext(resolveSyncServerUrl(get().syncConfig))
					const vaults = await platform.remoteVault.list()
					set((state) => {
						state.remoteVaults = vaults
						state.loading = false
					})
				} catch (e) {
					set((state) => {
						state.loading = false
						state.error = String(e)
					})
				}
			},

			createRemoteVault: async (name, description) => {
				const platform = getPlatform()
				const syncConfig = get().syncConfig
				await prepareRemoteMutation(syncConfig)
				const vault = await platform.remoteVault.create(name, description)
				set((state) => {
					state.remoteVaults.push(vault)
				})
				return vault
			},

			updateRemoteVault: async (vaultId, name, description) => {
				const platform = getPlatform()
				const syncConfig = get().syncConfig
				await prepareRemoteMutation(syncConfig)
				const updated = await platform.remoteVault.update(vaultId, name, description)
				set((state) => {
					const index = state.remoteVaults.findIndex((v) => v.id === vaultId)
					if (index !== -1) {
						state.remoteVaults[index] = updated
					}
				})
			},

			deleteRemoteVault: async (vaultId) => {
				const platform = getPlatform()
				const syncConfig = get().syncConfig
				await prepareRemoteMutation(syncConfig)
				await platform.remoteVault.delete(vaultId)
				set((state) => {
					state.remoteVaults = state.remoteVaults.filter((v) => v.id !== vaultId)
					if (state.linkedVaultId === vaultId) {
						state.linkedVaultId = null
						state.syncConfig.remoteVaultId = null
					}
				})
			},

			linkVault: async (vaultPath, remoteVaultId) => {
				const platform = getPlatform()
				await ensureRemoteMutationAllowed(get().syncConfig)
				await platform.remoteVault.link(vaultPath, remoteVaultId)
				set((state) => {
					state.linkedVaultId = remoteVaultId
					state.syncConfig.remoteVaultId = remoteVaultId
				})
			},

			unlinkVault: async (vaultPath) => {
				const platform = getPlatform()
				await platform.remoteVault.unlink(vaultPath)
				set((state) => {
					state.linkedVaultId = null
					state.syncConfig.remoteVaultId = null
				})
			},

			loadLink: async (vaultPath) => {
				if (!vaultPath) {
					set((state) => {
						state.linkedVaultId = null
						state.syncConfig = createDefaultSyncConfig()
					})
					return
				}
				try {
					const platform = getPlatform()
					const config = normalizeSyncConfig(await platform.remoteVault.readSyncConfig(vaultPath))
					set((state) => {
						state.syncConfig = config
						state.linkedVaultId = config.remoteVaultId
					})
					await syncAuthContext(resolveSyncServerUrl(config))
				} catch {
					const config = createDefaultSyncConfig()
					set((state) => {
						state.syncConfig = config
						state.linkedVaultId = null
					})
				}
			},

			updateSyncConfigValue: async (vaultPath, key, value) => {
				const platform = getPlatform()
				await platform.remoteVault.updateSyncConfig(vaultPath, key, value)
				set((state) => {
					;(state.syncConfig as Record<string, unknown>)[key] = value
					if (key === "remoteVaultId") {
						state.linkedVaultId = value as string | null
					}
				})
			},

			setSyncEnabled: async (vaultPath, enabled) => {
				if (enabled) {
					const syncConfig = get().syncConfig
					const status = await refreshAuthStatus(resolveSyncServerUrl(syncConfig))
					if (!status.authenticated) {
						throw new Error("Sign in before enabling sync")
					}
					await ensureRemoteMutationAllowed(syncConfig)
				}
				await get().updateSyncConfigValue(vaultPath, "enabled", enabled)
			},

			setSelfHosted: async (vaultPath, selfHosted) => {
				await get().updateSyncConfigValue(vaultPath, "selfHosted", selfHosted)
			},

			saveServerUrl: async (vaultPath, serverUrl) => {
				const normalizedServerUrl = normalizeServerUrl(serverUrl)
				await get().updateSyncConfigValue(vaultPath, "serverUrl", normalizedServerUrl)
				await syncAuthContext(normalizedServerUrl)
			},

			updateSelfHostedEnvironment: async (vaultPath, key, value) => {
				const nextEnvironment = { ...get().syncConfig.selfHostedEnvironment }
				if (value === null || value === "") {
					delete nextEnvironment[key]
				} else {
					nextEnvironment[key] = value
				}
				await get().updateSyncConfigValue(vaultPath, "selfHostedEnvironment", nextEnvironment)
			},

			clearLink: () =>
				set((state) => {
					state.linkedVaultId = null
					state.syncConfig.remoteVaultId = null
				}),

			clearError: () =>
				set((state) => {
					state.error = null
				}),
		})),
		{ name: "remoteVaultStore" },
	),
)
