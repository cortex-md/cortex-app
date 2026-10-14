import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
	test: {
		name: "desktop-electron",
		root,
		environment: "node",
		include: ["electron/**/*.test.ts"],
	},
})
