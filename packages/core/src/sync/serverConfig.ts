import type { SyncConfig } from "@cortex/platform"

interface CortexRuntimeConfig {
	__CORTEX_SYNC_SERVER_URL__?: string
	__CORTEX_BILLING_URL__?: string
}

const runtimeConfig = globalThis as CortexRuntimeConfig

export const DEFAULT_CLOUD_SYNC_SERVER_URL = normalizeServerUrl(
	runtimeConfig.__CORTEX_SYNC_SERVER_URL__ || "http://localhost:8080",
)
export const DEFAULT_SELF_HOSTED_SYNC_SERVER_URL = "http://localhost:8080"
export const DEFAULT_SYNC_SERVER_URL = DEFAULT_CLOUD_SYNC_SERVER_URL

export const BILLING_URL = normalizeServerUrl(
	runtimeConfig.__CORTEX_BILLING_URL__ || "http://localhost:3000/billing",
)

export function normalizeServerUrl(serverUrl: string): string {
	return serverUrl.trim().replace(/\/+$/, "")
}

export function resolveSyncServerUrl(config: Pick<SyncConfig, "selfHosted" | "serverUrl">): string {
	if (config.selfHosted) {
		return normalizeServerUrl(config.serverUrl || DEFAULT_SELF_HOSTED_SYNC_SERVER_URL)
	}
	return DEFAULT_CLOUD_SYNC_SERVER_URL
}

export function requiresCloudEntitlement(config: Pick<SyncConfig, "selfHosted">): boolean {
	return !config.selfHosted
}
