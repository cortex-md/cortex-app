import { resolve } from "node:path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const syncServerUrl = process.env.CORTEX_SYNC_SERVER_URL || "http://localhost:8080"
const billingUrl = process.env.CORTEX_BILLING_URL || "http://localhost:3000/billing"

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		resolve: {
			alias: {
				"@noble/hashes/blake3": resolve(
					__dirname,
					"node_modules/@noble/hashes/esm/blake3.js",
				),
				"@noble/hashes/utils": resolve(
					__dirname,
					"node_modules/@noble/hashes/esm/utils.js",
				),
			},
		},
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, "electron/main.ts"),
					"sync-worker": resolve(__dirname, "../../packages/sync-engine/src/worker.ts"),
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
			"globalThis.__CORTEX_BILLING_URL__": JSON.stringify(billingUrl),
		},
		resolve: {
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
