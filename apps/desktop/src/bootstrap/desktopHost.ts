import { useVaultStore } from "@cortex/core"
import { findThemeFamily, setMarketplaceCallbacks } from "@cortex/marketplace"
import { bundledPlugins } from "@cortex/plugins"
import { getThemeManager } from "@cortex/theme"
import { reloadCommunityThemes } from "../features/themes/communityThemeLoader"
import { sendCoreNotification } from "../utils/nativeNotifications"
import { registerAppCommands } from "./appCommands"
import { initializeCommandHotkeyBridge } from "./commandHotkeyBridge"
import { registerCoreContributions } from "./coreContributions"
import { pluginHost } from "./pluginHost"

let initialized = false

export function initializeDesktopHost(): void {
	if (initialized) return
	initialized = true
	registerAppCommands()
	initializeCommandHotkeyBridge()
	registerCoreContributions()
	pluginHost.registerBundledPlugins(bundledPlugins)
	setMarketplaceCallbacks({
		getPluginsDir: pluginHost.getCommunityPluginsDir,
		getThemesDir: () => {
			const vaultPath = useVaultStore.getState().vault?.path
			return vaultPath ? `${vaultPath}/.cortex/themes` : null
		},
		pluginHost,
		reloadThemes: reloadCommunityThemes,
		isThemeInstalled: (id) =>
			findThemeFamily({ id, name: id }, getThemeManager().getThemeFamilies()) !== null,
		notify: (event) => {
			void sendCoreNotification({
				id: `marketplace:${event.action}:${event.kind}:${event.entryId}`,
				tag: `marketplace:${event.kind}:${event.entryId}`,
				title: event.title,
				body: event.body,
				kind: event.level,
				urgency: event.level === "error" ? "high" : "normal",
			})
		},
	})
}
