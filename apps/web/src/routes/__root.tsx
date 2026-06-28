import { TanStackDevtools } from "@tanstack/react-devtools"
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import type React from "react"
import { getThemeInitScript } from "../features/site/theme"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
	head: () => ({
		meta: [],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.ico", sizes: "any" },
			{ rel: "icon", type: "image/png", href: "/icon-192.png" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/manifest.json" },
		],
	}),
	shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#fbfbfc" />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme bootstrap prevents a light/dark flash before app hydration.
					dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
				/>
				<HeadContent />
			</head>
			<body>
				<a
					className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2 focus-visible:ring-ring/40"
					href="#main-content"
				>
					Skip to content
				</a>
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
				<Analytics />
				<SpeedInsights />
				<Scripts />
			</body>
		</html>
	)
}
