import { reportAppError } from "@cortex/core"
import {
	ALLOW_COMMUNITY_PLUGINS_CONFIRMATION,
	getPluginEnableConfirmation,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import type { PluginRecord } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"

import { mobilePluginHost } from "@/bootstrap/pluginHost"

export function useCommunityPluginsAllowed(): boolean {
	return useSettingsStore((state) => state.settings.plugins.allowCommunity)
}

export async function setCommunityPluginsAllowed(allowed: boolean): Promise<void> {
	if (allowed && !(await getPlatform().dialog.showConfirm(ALLOW_COMMUNITY_PLUGINS_CONFIRMATION))) {
		return
	}
	await useSettingsStore
		.getState()
		.updateSetting("plugins", "allowCommunity", allowed)
		.catch((cause: unknown) =>
			reportAppError({
				operation: "update-setting",
				source: "mobile-settings",
				cause,
				userMessage: "Unable to save this setting.",
			}),
		)
}

export async function enablePluginWithConsent(record: PluginRecord): Promise<boolean> {
	if (
		record.community &&
		!(await getPlatform().dialog.showConfirm(getPluginEnableConfirmation(record.manifest)))
	) {
		return false
	}
	await mobilePluginHost.enablePlugin(record.manifest.id)
	return true
}
