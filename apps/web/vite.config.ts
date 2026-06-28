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
	"CORTEX_DOWNLOAD_MACOS_URL",
	"CORTEX_DOWNLOAD_WINDOWS_URL",
	"CORTEX_DOWNLOAD_LINUX_URL",
] as const
const dynamicPrerenderPaths = new Set(["/account", "/billing", "/changelog", "/login", "/signup"])

function getPrerenderPathname(routePath: string) {
	return routePath.split("?")[0]?.split("#")[0] ?? routePath
}

export default defineConfig(({ mode }) => {
	const environment = loadEnv(mode, import.meta.dirname, "")
	const siteUrl = (environment.SITE_URL || defaultSiteUrl).replace(/\/$/, "")
	const macosDownloadUrl = environment.CORTEX_DOWNLOAD_MACOS_URL?.trim() ?? ""
	const windowsDownloadUrl = environment.CORTEX_DOWNLOAD_WINDOWS_URL?.trim() ?? ""
	const linuxDownloadUrl = environment.CORTEX_DOWNLOAD_LINUX_URL?.trim() ?? ""

	for (const key of runtimeEnvKeys) {
		if (environment[key] && !process.env[key]) {
			process.env[key] = environment[key]
		}
	}

	return {
		define: {
			"import.meta.env.SITE_URL": JSON.stringify(siteUrl),
			"import.meta.env.CORTEX_DOWNLOAD_MACOS_URL": JSON.stringify(macosDownloadUrl),
			"import.meta.env.CORTEX_DOWNLOAD_WINDOWS_URL": JSON.stringify(windowsDownloadUrl),
			"import.meta.env.CORTEX_DOWNLOAD_LINUX_URL": JSON.stringify(linuxDownloadUrl),
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
					filter: ({ path }) =>
						!path.includes("#") && !dynamicPrerenderPaths.has(getPrerenderPathname(path)),
				},
				sitemap: {
					enabled: true,
					host: siteUrl,
				},
			}),
			viteReact(),
		],
	}
})
