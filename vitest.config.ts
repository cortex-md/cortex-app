import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		projects: [
			"apps/desktop",
			"apps/desktop/vitest.electron.config.ts",
			"packages/*",
			"!packages/plugin-api",
			"!packages/collab",
			"!packages/comments",
			"!packages/sync-api",
			"!packages/tasks",
			"!packages/theme",
		],
	},
})
