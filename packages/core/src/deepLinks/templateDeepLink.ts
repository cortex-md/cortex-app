import { getPlatform } from "@cortex/platform"

export const TEMPLATE_LINK_ENTRY_PREFIX = "link:"

export function parseTemplateDeepLink(value: string): string | null {
	try {
		const url = new URL(value)
		if (url.protocol !== "cortex:" || url.hostname !== "t") return null
		const slug = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
		return /^[A-Za-z0-9_-]{4,64}$/.test(slug) ? slug : null
	} catch {
		return null
	}
}

export function startTemplateDeepLinks(openTemplateLink: (entryId: string) => void): () => void {
	return getPlatform().app.onDeepLinkOpen((urls) => {
		const slug = urls.map(parseTemplateDeepLink).find((candidate) => candidate !== null)
		if (!slug) return
		openTemplateLink(`${TEMPLATE_LINK_ENTRY_PREFIX}${slug}`)
	})
}
