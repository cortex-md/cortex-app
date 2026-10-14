import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"

const syncServerUrl = process.env.CORTEX_SYNC_SERVER_URL || "http://localhost:8080"
const registryRepo = process.env.CORTEX_REGISTRY_REPO || "cortex-md/registry"
const billingUrl = process.env.CORTEX_BILLING_URL || "http://localhost:3000/billing"

export default defineConfig({
	main: {
		plugins: [
			externalizeDepsPlugin({
				exclude: [
					"@cortex/collab",
					"@cortex/core",
					"@cortex/platform",
					"@cortex/sync-api",
					"@cortex/sync-engine",
					"@cortex/tasks",
					"@noble/hashes",
				],
				include: ["argon2"],
			}),
		],
		resolve: {
			alias: {
				"@noble/hashes/blake3": resolve(__dirname, "node_modules/@noble/hashes/esm/blake3.js"),
				"@noble/hashes/utils": resolve(__dirname, "node_modules/@noble/hashes/esm/utils.js"),
			},
		},
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
		plugins: [externalizeDepsPlugin()],
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
		plugins: [react(), tailwindcss()],
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
