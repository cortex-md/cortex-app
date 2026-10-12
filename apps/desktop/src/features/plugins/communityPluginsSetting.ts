import { ALLOW_COMMUNITY_PLUGINS_CONFIRMATION } from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"

export function useCommunityPluginsAllowed(): boolean {
	return useSettingsStore((state) => state.settings.plugins.allowCommunity)
}

export async function setCommunityPluginsAllowed(allowed: boolean): Promise<void> {
	if (allowed && !(await getPlatform().dialog.showConfirm(ALLOW_COMMUNITY_PLUGINS_CONFIRMATION))) {
		return
	}
	await useSettingsStore.getState().updateSetting("plugins", "allowCommunity", allowed)
}
