import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
	test: {
		name: "editor",
		root,
		environment: "jsdom",
		fileParallelism: false,
		globals: true,
		include: ["src/**/*.test.{ts,tsx}"],
	},
})
