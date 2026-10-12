import { getPlatform } from "@cortex/platform"
import { router } from "expo-router"

export function openMarketplace(): void {
	router.push("/(settings)/marketplace" as never)
}

export function openMarketplaceEntry(entryId: string): void {
	router.push({ params: { id: entryId }, pathname: "/(settings)/marketplace-detail" as never })
}

export function openMarketplaceReadme(entryId: string): void {
	router.push({ params: { id: entryId }, pathname: "/(settings)/marketplace-readme" as never })
}

export async function openExternalUrl(url: string): Promise<void> {
	await getPlatform().app.openExternalUrl(url)
}
