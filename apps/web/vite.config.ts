import path from "node:path"
import contentCollections from "@content-collections/vite"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig, loadEnv } from "vite"

const defaultSiteUrl = "https://cortex-md.tech"
const uiSource = path.resolve(import.meta.dirname, "../../packages/ui/src")
const webNodeModules = path.resolve(import.meta.dirname, "node_modules")
const runtimeEnvKeys = [
	"SITE_URL",
	"CORTEX_SYNC_URL",
	"CORTEX_BILLING_RETURN_URL",
	"CORTEX_BILLING_COMPLETION_URL",
	"CORTEX_REGISTRY_REPO",
] as const
const dynamicPrerenderPaths = new Set([
	"/account",
	"/billing",
	"/billing/cancelled",
	"/billing/success",
	"/changelog",
	"/login",
	"/signup",
	"/marketplace/browse",
])
const dynamicPrerenderPrefixes = [
	"/invite/",
	"/marketplace/plugins/",
	"/marketplace/themes/",
	"/marketplace/templates/",
]

function getPrerenderPathname(routePath: string) {
	return routePath.split("?")[0]?.split("#")[0] ?? routePath
}

export default defineConfig(({ mode }) => {
	const environment = loadEnv(mode, import.meta.dirname, "")
	const siteUrl = (environment.SITE_URL || defaultSiteUrl).replace(/\/$/, "")

	for (const key of runtimeEnvKeys) {
		if (environment[key] && !process.env[key]) {
			process.env[key] = environment[key]
		}
	}

	return {
		define: {
			"import.meta.env.SITE_URL": JSON.stringify(siteUrl),
			"import.meta.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN": JSON.stringify(
				environment.CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
					process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
					"",
			),
		},
		ssr: {
			noExternal: ["lucide-react"],
		},
		resolve: {
			tsconfigPaths: true,
			dedupe: ["react", "react-dom"],
			alias: [
				{
					find: /^cmdk$/,
					replacement: path.resolve(webNodeModules, "cmdk/dist/index.mjs"),
				},
				{
					find: /^radix-ui$/,
					replacement: path.resolve(webNodeModules, "radix-ui/dist/index.mjs"),
				},
				{
					find: /^@cortex\/ui\/(.+)$/,
					replacement: `${uiSource}/$1`,
				},
				{
					find: "@cortex/ui",
					replacement: `${uiSource}/index.ts`,
				},
			],
		},
		plugins: [
			contentCollections(),
			mode === "development" ? devtools() : null,
			nitro(),
			tailwindcss(),
			tanstackStart({
				prerender: {
					enabled: true,
					crawlLinks: true,
					failOnError: true,
					filter: ({ path }) => {
						const pathname = getPrerenderPathname(path)
						return (
							!path.includes("#") &&
							!dynamicPrerenderPaths.has(pathname) &&
							!dynamicPrerenderPrefixes.some((prefix) => pathname.startsWith(prefix))
						)
					},
				},
				sitemap: {
					enabled: false,
				},
			}),
			viteReact(),
		],
	}
})
