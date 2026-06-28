import { track } from "@vercel/analytics"

type LandingEvent =
	| { name: "hero_primary_cta_clicked"; location: "header" | "hero" | "footer" }
	| { name: "hero_demo_clicked" }
	| { name: "download_clicked"; platform: "macos" | "windows" | "linux"; format?: string }
	| { name: "github_clicked"; location: "developers" | "footer" | "header" }
	| { name: "login_clicked"; location: "header" | "header_mobile" }
	| { name: "account_clicked"; location: "header" | "header_mobile" }
	| { name: "pricing_checkout_clicked"; location: "pricing" | "billing" }
	| { name: "faq_opened"; question: string }

declare global {
	interface Window {
		dataLayer?: Array<Record<string, unknown>>
	}
}

export function trackLandingEvent(event: LandingEvent) {
	if (typeof window === "undefined") {
		return
	}

	const { name, ...properties } = event
	window.dataLayer?.push({ event: name, ...properties })
	track(name, properties)
}
