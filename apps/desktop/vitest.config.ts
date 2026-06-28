import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))
const workspaceNodeModules = fileURLToPath(new URL("../../node_modules", import.meta.url))

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			react: `${workspaceNodeModules}/react`,
			"react-dom": `${workspaceNodeModules}/react-dom`,
		},
		dedupe: ["react", "react-dom"],
	},
	test: {
		name: "desktop",
		root,
		environment: "jsdom",
		globals: true,
		maxWorkers: 4,
		setupFiles: ["src/__tests__/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
})
