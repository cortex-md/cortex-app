import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST
const syncServerUrl = process.env.CORTEX_SYNC_SERVER_URL || "http://localhost:8080"
const billingUrl = process.env.CORTEX_BILLING_URL || "http://localhost:3000/billing"

export default defineConfig(async () => ({
	plugins: [react(), tailwindcss()],
	define: {
		"globalThis.__CORTEX_SYNC_SERVER_URL__": JSON.stringify(syncServerUrl),
		"globalThis.__CORTEX_BILLING_URL__": JSON.stringify(billingUrl),
	},

	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@cortex.md/api": path.resolve(__dirname, "../../packages/plugin-api/src/index.ts"),
		},
	},

	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
}))
