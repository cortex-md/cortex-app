import { getPlatform } from "@cortex/platform"

import { openSettings } from "@/features/navigation/routes"

export function openMarketplace(): void {
	openSettings("marketplace")
}

export type MarketplaceEntryKind = "plugin" | "theme" | "template"

export function openMarketplaceEntry(entryId: string, kind: MarketplaceEntryKind = "plugin"): void {
	openSettings("marketplace-detail", { id: entryId, kind })
}

export function openMarketplaceReadme(entryId: string): void {
	openSettings("marketplace-readme", { id: entryId })
}

export async function openExternalUrl(url: string): Promise<void> {
	await getPlatform().app.openExternalUrl(url)
}
