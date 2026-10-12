import { reportAppError } from "@cortex/core"
import { type MarketplaceNotificationEvent, setMarketplaceCallbacks } from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"

import { mobilePluginHost } from "@/bootstrap/pluginHost"

async function notifyMarketplaceEvent(event: MarketplaceNotificationEvent): Promise<void> {
	if (event.level === "error") {
		await reportAppError({
			operation: `marketplace-${event.action}`,
			source: "mobile-marketplace",
			cause: event.body,
			userMessage: event.body ? `${event.title}: ${event.body}` : event.title,
			context: { entryId: event.entryId },
		})
		return
	}
	if (event.action !== "install") return
	await getPlatform().dialog.showAlert({
		title: event.title,
		message: `Enable ${event.body ?? event.entryId} in Settings → Plugins.`,
	})
}

export function registerMobileMarketplace(): void {
	setMarketplaceCallbacks({
		getPluginsDir: mobilePluginHost.getCommunityPluginsDir,
		getThemesDir: () => null,
		pluginHost: mobilePluginHost,
		reloadThemes: async () => {},
		isThemeInstalled: () => false,
		notify: notifyMarketplaceEvent,
	})
}
