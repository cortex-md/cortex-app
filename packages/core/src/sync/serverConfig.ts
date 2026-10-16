import type { SyncConfig } from "@cortex/platform"

declare global {
	var __CORTEX_SYNC_SERVER_URL__: string | undefined
	var __CORTEX_BILLING_URL__: string | undefined
}

export const DEFAULT_CLOUD_SYNC_SERVER_URL = normalizeServerUrl(
	globalThis.__CORTEX_SYNC_SERVER_URL__ || "https://api.cortex-md.tech",
)
export const DEFAULT_SELF_HOSTED_SYNC_SERVER_URL = "http://localhost:8080"
export const DEFAULT_SYNC_SERVER_URL = DEFAULT_CLOUD_SYNC_SERVER_URL

export const BILLING_URL = normalizeServerUrl(
	globalThis.__CORTEX_BILLING_URL__ || "http://localhost:3000/billing",
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

export const CLOUD_SERVER_LABEL = "Cortex Cloud"

export function describeServerUrl(serverUrl: string): string {
	try {
		return new URL(serverUrl).host || "Self-hosted"
	} catch {
		return "Self-hosted"
	}
}

export function getSyncServerLabel(config: Pick<SyncConfig, "selfHosted" | "serverUrl">): string {
	return config.selfHosted ? describeServerUrl(resolveSyncServerUrl(config)) : CLOUD_SERVER_LABEL
}
