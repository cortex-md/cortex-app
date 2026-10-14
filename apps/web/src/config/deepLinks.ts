export const cortexAppUrl = "cortex://"

export type MarketplaceDeepLinkKind = "plugins" | "themes" | "templates"

// Flip once the desktop app registers cortex://marketplace/<kind>/<id>.
export const marketplaceDeepLinksSupported = false

export function getMarketplaceInstallUrl(kind: MarketplaceDeepLinkKind, id: string) {
	return `cortex://marketplace/${kind}/${encodeURIComponent(id)}`
}

export function getInviteDeepLink(token: string) {
	return `cortex://invite/${encodeURIComponent(token)}`
}
