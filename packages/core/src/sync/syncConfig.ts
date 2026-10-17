import type { SyncConfig } from "@cortex/platform"
import { getVaultSyncState } from "../vault/vaultStateFiles"
import { DEFAULT_SELF_HOSTED_SYNC_SERVER_URL } from "./serverConfig"

type RawSyncConfig = Record<string, unknown>

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

export function normalizeSyncConfig(config: Partial<SyncConfig> | RawSyncConfig): SyncConfig {
	const { enabled, remoteVaultId, selfHosted, serverUrl, offlineMode, selfHostedEnvironment } =
		config as RawSyncConfig
	return {
		enabled: enabled === true,
		remoteVaultId: typeof remoteVaultId === "string" && remoteVaultId ? remoteVaultId : null,
		selfHosted: selfHosted === true,
		serverUrl:
			(typeof serverUrl === "string" && serverUrl.trim()) || DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
		offlineMode: offlineMode === true,
		selfHostedEnvironment:
			selfHostedEnvironment && typeof selfHostedEnvironment === "object"
				? (selfHostedEnvironment as Record<string, string>)
				: {},
	}
}

async function readRawSyncConfig(vaultPath: string): Promise<RawSyncConfig> {
	return { ...(await getVaultSyncState(vaultPath).read()).config }
}

export async function readSyncConfig(vaultPath: string): Promise<SyncConfig> {
	return normalizeSyncConfig(await readRawSyncConfig(vaultPath))
}

function mutateSyncConfig(
	vaultPath: string,
	mutate: (config: RawSyncConfig) => void,
): Promise<void> {
	return getVaultSyncState(vaultPath).update(
		(state) => {
			const config = { ...state.config }
			mutate(config)
			return { ...state, config }
		},
		{ immediate: true },
	)
}

export function updateSyncConfig(vaultPath: string, changes: Partial<SyncConfig>): Promise<void> {
	return mutateSyncConfig(vaultPath, (config) => Object.assign(config, changes))
}

export function linkRemoteVault(vaultPath: string, remoteVaultId: string): Promise<void> {
	return updateSyncConfig(vaultPath, { remoteVaultId })
}

export function unlinkRemoteVault(vaultPath: string): Promise<void> {
	return mutateSyncConfig(vaultPath, (config) => {
		delete config.remoteVaultId
	})
}
