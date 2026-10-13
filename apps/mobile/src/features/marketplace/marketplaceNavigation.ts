import { getPlatform } from "@cortex/platform"

import { openSettings } from "@/features/navigation/routes"

export function openMarketplace(): void {
	openSettings("marketplace")
}

export function openMarketplaceEntry(entryId: string): void {
	openSettings("marketplace-detail", { id: entryId })
}

export function openMarketplaceReadme(entryId: string): void {
	openSettings("marketplace-readme", { id: entryId })
}

export async function openExternalUrl(url: string): Promise<void> {
	await getPlatform().app.openExternalUrl(url)
}
