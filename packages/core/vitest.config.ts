import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
	resolve: {
		alias: {
			"@cortex/databases": fileURLToPath(new URL("../databases/src/index.ts", import.meta.url)),
			"@cortex/properties/codemirror": fileURLToPath(
				new URL("../properties/src/codemirror.ts", import.meta.url),
			),
			"@cortex/properties": fileURLToPath(new URL("../properties/src/index.ts", import.meta.url)),
		},
	},
	test: {
		name: "core",
		root,
		environment: "node",
		globals: true,
		setupFiles: ["src/stores/__tests__/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
})
