import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
	test: {
		name: "core",
		root,
		environment: "node",
		globals: true,
		setupFiles: ["src/stores/__tests__/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
})
