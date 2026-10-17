import { reportAppError } from "@cortex/core"
import {
	findThemeFamily,
	type MarketplaceNotificationEvent,
	setMarketplaceCallbacks,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { getThemeManager } from "@cortex/theme"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { toast } from "@/features/feedback/useToast"
import { getCommunityThemesDir, reloadCommunityThemes } from "@/features/themes/communityThemes"

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
	if (event.kind === "themes") {
		if (event.action === "uninstall") await reloadCommunityThemes()
		toast(event.title)
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
		getThemesDir: getCommunityThemesDir,
		pluginHost: mobilePluginHost,
		reloadThemes: reloadCommunityThemes,
		isThemeInstalled: (id) =>
			findThemeFamily({ id, name: id }, getThemeManager().getThemeFamilies()) !== null,
		notify: notifyMarketplaceEvent,
	})
}
