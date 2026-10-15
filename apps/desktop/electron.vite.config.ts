import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "electron-vite"
import type { Plugin } from "vite"

const syncServerUrl = process.env.CORTEX_SYNC_SERVER_URL || "http://localhost:8080"
const registryRepo = process.env.CORTEX_REGISTRY_REPO || "cortex-md/registry"
const billingUrl = process.env.CORTEX_BILLING_URL || "http://localhost:3000/billing"

const productionCsp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-eval' data: blob:",
	"worker-src 'self' blob:",
	"style-src 'self' 'unsafe-inline' data: blob: cortex-file:",
	"img-src 'self' data: blob: cortex-file: https: http:",
	"media-src 'self' data: blob: cortex-file: https: http:",
	"font-src 'self' data: blob: cortex-file: https:",
	"connect-src 'self' data: blob: cortex-file: https: http: ws: wss:",
	"frame-src 'self' https:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'none'",
].join("; ")

function productionCspPlugin(): Plugin {
	return {
		name: "cortex-production-csp",
		apply: "build",
		transformIndexHtml: (html) =>
			html.replace(
				/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/,
				`$1${productionCsp}$2`,
			),
	}
}

export default defineConfig({
	main: {
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, "electron/main.ts"),
					"sync-worker": resolve(__dirname, "electron/syncWorker.ts"),
				},
			},
		},
	},
	preload: {
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, "electron/preload.ts"),
				},
				output: {
					format: "cjs",
				},
			},
		},
	},
	renderer: {
		root: ".",
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, "index.html"),
				},
			},
		},
		plugins: [react(), tailwindcss(), productionCspPlugin()],
		define: {
			"globalThis.__CORTEX_SYNC_SERVER_URL__": JSON.stringify(syncServerUrl),
			"globalThis.__CORTEX_REGISTRY_REPO__": JSON.stringify(registryRepo),
			"globalThis.__CORTEX_BILLING_URL__": JSON.stringify(billingUrl),
		},
		resolve: {
			dedupe: ["yjs", "@codemirror/state", "@codemirror/view"],
			alias: {
				"@": resolve(__dirname, "src"),
				"@cortex.md/api": resolve(__dirname, "../../packages/plugin-api/src/index.ts"),
			},
		},
		server: {
			port: 1420,
			strictPort: true,
		},
	},
})
