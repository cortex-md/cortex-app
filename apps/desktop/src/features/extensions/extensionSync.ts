import { useSyncStore, useVaultStore } from "@cortex/core"
import { type ExtensionSyncKind, startExtensionSync } from "@cortex/marketplace"
import { selectPluginSyncSnapshot, usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { pluginHost } from "../../bootstrap/pluginHost"
import { scheduleIdleWork } from "../../utils/scheduleIdleWork"

const SYNC_FLAGS = {
	plugins: "syncPluginMetadata",
	themes: "syncThemeMetadata",
} as const satisfies Record<ExtensionSyncKind, string>

export function startDesktopExtensionSync(): () => void {
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
		enablePlugin: (pluginId) => pluginHost.enablePlugin(pluginId),
		disablePlugin: (pluginId) => pluginHost.disablePlugin(pluginId),
		saveEnabledPlugins: () => pluginHost.saveEnabledPlugins(),
		scheduleIdle: scheduleIdleWork,
	})
}
