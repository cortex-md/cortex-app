import {
	useAuthStore,
	useEditorStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useTemplateStore,
	useVaultStore,
} from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { usePluginStore } from "@cortex/plugin-host-core"
import { type AppSettings, getSettingsManager, useSettingsStore } from "@cortex/settings"
import { type MirroredStore, mirrorStore } from "./windowBridge"

type SettingsPages = ReturnType<typeof usePluginStore.getState>["settingsPages"]

function toSerializablePages(pages: SettingsPages): SettingsPages {
	return pages
		.filter((page) => !page.component && page.schema)
		.map((page) => ({ ...page, icon: typeof page.icon === "string" ? page.icon : "puzzle" }))
}

const pluginSettingsPagesMirror: MirroredStore = {
	name: "plugin-settings-pages",
	from: "main",
	pick: () => ({ settingsPages: toSerializablePages(usePluginStore.getState().settingsPages) }),
	subscribe: (listener) =>
		usePluginStore.subscribe((state, previous) => {
			if (state.settingsPages !== previous.settingsPages) {
				listener({ settingsPages: toSerializablePages(state.settingsPages) })
			}
		}),
	apply: (slice) =>
		usePluginStore.setState({ settingsPages: slice.settingsPages as SettingsPages }),
}

type GlobalSettingsSlice = Pick<AppSettings, "plugins"> & { nativeWindowEffects: boolean }

function pickGlobalSettings(settings: AppSettings): GlobalSettingsSlice {
	return { plugins: settings.plugins, nativeWindowEffects: settings.appearance.nativeWindowEffects }
}

const globalSettingsMirror: MirroredStore = {
	name: "global-settings",
	from: "both",
	pick: () => pickGlobalSettings(useSettingsStore.getState().settings),
	subscribe: (listener) =>
		useSettingsStore.subscribe((state, previous) => {
			const changed =
				state.settings.plugins !== previous.settings.plugins ||
				state.settings.appearance.nativeWindowEffects !==
					previous.settings.appearance.nativeWindowEffects
			if (changed) listener(pickGlobalSettings(state.settings))
		}),
	apply: (slice) => {
		const { plugins, nativeWindowEffects } = slice as GlobalSettingsSlice
		const current = useSettingsStore.getState().settings
		const settings = {
			...current,
			plugins,
			appearance: { ...current.appearance, nativeWindowEffects },
		}
		getSettingsManager().applyExternalSettings(settings)
		useSettingsStore.setState({ settings })
	},
}

export const MIRRORED_STORES = [
	globalSettingsMirror,
	mirrorStore("settings", useSettingsStore, ["settings"], {
		apply: ({ settings }) => {
			getSettingsManager().applyExternalSettings(settings)
			useSettingsStore.setState({ settings })
		},
	}),
	mirrorStore("hotkeys", useHotkeysStore, ["bindings", "overrides"], {
		apply: ({ bindings, overrides }) =>
			useHotkeysStore.getState().applyBindings(bindings, overrides),
	}),
	mirrorStore("recent-vaults", useVaultStore, ["recentVaults"]),
	mirrorStore("auth", useAuthStore, ["authenticated", "user", "serverUrl"]),
	mirrorStore("remote-vault", useRemoteVaultStore, ["remoteVaults", "linkedVaultId", "syncConfig"]),
	mirrorStore("sync", useSyncStore, [
		"engineState",
		"lastSyncedAt",
		"initialSyncProgress",
		"initialSyncComplete",
		"vekRequired",
		"keyTrustIssues",
		"syncPreferences",
	]),
	mirrorStore("subscription", useSubscriptionStore, ["statusByServer", "block"]),
	mirrorStore("templates", useTemplateStore, ["templates", "loadedVaultPath"]),
	mirrorStore("editor", useEditorStore, ["activeFilePath"], { from: "main" }),
	mirrorStore("plugins", usePluginStore, ["plugins", "loadErrors", "settingsValues"], {
		from: "main",
	}),
	pluginSettingsPagesMirror,
]
