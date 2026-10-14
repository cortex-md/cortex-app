import geistLatinUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url"
import { TanStackDevtools } from "@tanstack/react-devtools"
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import type React from "react"
import { siteConfig } from "../config/site"
import { NotFoundPage } from "../features/site/NotFoundPage"
import { RouteErrorPage } from "../features/site/RouteErrorPage"
import { SiteFooter } from "../features/site/SiteFooter"
import { SiteHeader } from "../features/site/SiteHeader"
import { getThemeInitScript } from "../features/site/theme"
import { isPrivateAnalyticsPath, redactAnalyticsUrl } from "../lib/analytics"
import appCss from "../styles.css?url"

const cloudflareAnalyticsToken = import.meta.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ name: "theme-color", content: "#fcfcfb" },
			{ name: "color-scheme", content: "light dark" },
			{ name: "format-detection", content: "telephone=no" },
			{ property: "og:locale", content: siteConfig.locale },
		],
		links: [
			{
				rel: "preload",
				href: geistLatinUrl,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.ico", sizes: "any" },
			{ rel: "icon", type: "image/png", href: "/icon-192.png" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/manifest.json" },
		],
	}),
	shellComponent: RootDocument,
	component: RootLayout,
	errorComponent: RouteErrorPage,
	notFoundComponent: NotFoundPage,
})

function RootLayout() {
	return (
		<>
			<a
				className="sr-only z-50 rounded-md bg-bg-elevated px-3 py-2 text-sm font-semibold text-text-primary shadow-ring focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
				href="#main-content"
			>
				Skip to content
			</a>
			<SiteHeader />
			<main id="main-content" className="min-w-0">
				<Outlet />
			</main>
			<SiteFooter />
		</>
	)
}

function CloudflareAnalytics() {
	const pathname = useRouterState({ select: (state) => state.location.pathname })

	if (!cloudflareAnalyticsToken || isPrivateAnalyticsPath(pathname)) return null

	return (
		<script
			defer
			src="https://static.cloudflareinsights.com/beacon.min.js"
			data-cf-beacon={JSON.stringify({ token: cloudflareAnalyticsToken, spa: false })}
		/>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme bootstrap prevents a light/dark flash before app hydration.
					dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
				/>
				<HeadContent />
			</head>
			<body>
				{children}
				{import.meta.env.DEV ? (
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "TanStack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				) : null}
				<Analytics beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />
				<SpeedInsights beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />
				<CloudflareAnalytics />
				<Scripts />
			</body>
		</html>
	)
}
