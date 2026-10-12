import { getPlatform, type SyncConfig } from "@cortex/platform"
import { getVaultFilePath, VAULT_CONFIG_DIR, VAULT_FILES } from "@cortex/platform/utils"
import { DEFAULT_SELF_HOSTED_SYNC_SERVER_URL } from "./serverConfig"

type RawSyncConfig = Record<string, unknown>

let pendingUpdate: Promise<unknown> = Promise.resolve()

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
	try {
		const parsed = JSON.parse(
			await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.syncConfig)),
		) as unknown
		return parsed && typeof parsed === "object" ? (parsed as RawSyncConfig) : {}
	} catch {
		return {}
	}
}

export async function readSyncConfig(vaultPath: string): Promise<SyncConfig> {
	return normalizeSyncConfig(await readRawSyncConfig(vaultPath))
}

function mutateSyncConfig(
	vaultPath: string,
	mutate: (config: RawSyncConfig) => void,
): Promise<void> {
	const update = pendingUpdate.then(async () => {
		const platform = getPlatform()
		const config = await readRawSyncConfig(vaultPath)
		mutate(config)
		await platform.fs.createDir(getVaultFilePath(vaultPath, VAULT_CONFIG_DIR))
		await platform.fs.atomicWriteFile(
			getVaultFilePath(vaultPath, VAULT_FILES.syncConfig),
			JSON.stringify(config, null, 2),
		)
	})
	pendingUpdate = update.catch(() => undefined)
	return update
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
