import { resolveSyncServerUrl } from "@cortex/core"
import type { SyncConfig } from "@cortex/platform"

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
