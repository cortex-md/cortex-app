import { track } from "@vercel/analytics"

type HeaderSurface = "header" | "sheet" | "footer"

export type SiteEvent =
	| { name: "nav_clicked"; item: string; surface: HeaderSurface }
	| { name: "download_clicked"; platform: "macos" | "windows" | "linux"; location: string }
	| { name: "github_clicked"; location: HeaderSurface | "page" }
	| { name: "login_clicked"; location: HeaderSurface | "page" }
	| { name: "account_clicked"; location: HeaderSurface }
	| { name: "hero_cta_clicked"; page: string; cta: string }
	| { name: "pricing_cta_clicked"; plan: "local" | "sync" | "self-hosted"; page: string }
	| { name: "checkout_started"; location: "pricing" | "billing" | "account" }
	| { name: "faq_opened"; question: string }
	| { name: "marketplace_filter_changed"; kind: string; sort: string }
	| { name: "marketplace_vote_clicked"; kind: string; id: string }
	| { name: "marketplace_install_opened"; kind: string; id: string }
	| { name: "marketplace_report_clicked"; kind: string; id: string }
	| { name: "changelog_feed_clicked"; feed: "rss" | "watch" }
	| { name: "roadmap_suggest_clicked" }
	| { name: "auth_completed"; mode: "login" | "signup" }
	| { name: "invite_accepted" }
	| { name: "device_revoked" }
	| { name: "signed_out_everywhere" }

const sensitivePathPatterns: Array<[RegExp, string]> = [[/^\/invite\/[^/?#]+/u, "/invite/[token]"]]

const privatePathPrefixes = ["/billing", "/account", "/login", "/signup", "/invite"]

export function redactAnalyticsUrl(rawUrl: string) {
	try {
		const url = new URL(rawUrl)
		for (const [pattern, replacement] of sensitivePathPatterns) {
			url.pathname = url.pathname.replace(pattern, replacement)
		}
		url.hash = ""
		if (privatePathPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
			url.search = ""
		}
		return url.toString()
	} catch {
		return rawUrl
	}
}

export function isPrivateAnalyticsPath(pathname: string) {
	return privatePathPrefixes.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	)
}

export function trackEvent(event: SiteEvent) {
	if (typeof window === "undefined") return

	const { name, ...properties } = event
	track(name, properties)
}
