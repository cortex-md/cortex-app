import { useSyncStore, useVaultStore } from "@cortex/core"
import { type ExtensionSyncKind, startExtensionSync } from "@cortex/marketplace"
import { selectPluginSyncSnapshot, usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"

import { mobilePluginHost } from "@/bootstrap/pluginHost"

const SYNC_FLAGS = {
	plugins: "syncPluginMetadata",
	themes: "syncThemeMetadata",
} as const satisfies Record<ExtensionSyncKind, string>

export function startMobileExtensionSync(): () => void {
	return startExtensionSync({
		getVaultPath: () => useVaultStore.getState().vault?.path ?? null,
		subscribeVault: (listener) =>
			useVaultStore.subscribe((state, previous) => {
				if (state.vault !== previous.vault) listener()
			}),
		isSyncEnabled: (kind) => useSyncStore.getState().syncPreferences[SYNC_FLAGS[kind]],
		isCommunityAllowed: () => useSettingsStore.getState().settings.plugins.allowCommunity,
		subscribeSettings: (listener) => {
			const stopSync = useSyncStore.subscribe((state, previous) => {
				if (state.syncPreferences !== previous.syncPreferences) listener()
			})
			const stopSettings = useSettingsStore.subscribe((state, previous) => {
				if (state.settings.plugins !== previous.settings.plugins) listener()
			})
			return () => {
				stopSync()
				stopSettings()
			}
		},
		getPlugins: () => selectPluginSyncSnapshot(usePluginStore.getState()),
		subscribePlugins: (listener) =>
			usePluginStore.subscribe((state, previous) => {
				if (
					state.plugins !== previous.plugins ||
					state.loadErrors !== previous.loadErrors ||
					state.loadedVaultPath !== previous.loadedVaultPath
				) {
					listener()
				}
			}),
		enablePlugin: (pluginId) => mobilePluginHost.enablePlugin(pluginId),
		disablePlugin: (pluginId) => mobilePluginHost.disablePlugin(pluginId),
		saveEnabledPlugins: () => mobilePluginHost.saveEnabledPlugins(),
	})
}
