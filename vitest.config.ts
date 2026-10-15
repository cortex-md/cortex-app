import { fileURLToPath } from "node:url"
import { defineConfig, type TestProjectInlineConfiguration } from "vitest/config"

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

function project(
	name: string,
	root: string,
	test: TestProjectInlineConfiguration["test"] = {},
): TestProjectInlineConfiguration {
	return {
		test: {
			name,
			root: fromRoot(root),
			environment: "node",
			globals: true,
			include: ["src/**/*.test.{ts,tsx}"],
			...test,
		},
	}
}

const domProject = { environment: "jsdom", fileParallelism: false } as const

export default defineConfig({
	test: {
		projects: [
			fromRoot("apps/desktop"),
			project("desktop-electron", "apps/desktop", { include: ["electron/**/*.test.ts"] }),
			project("mobile", "apps/mobile"),
			project("commands", "packages/commands"),
			project("core", "packages/core", { setupFiles: ["src/stores/__tests__/setup.ts"] }),
			project("editor", "packages/editor", domProject),
			project("hotkeys", "packages/hotkeys"),
			project("import-export", "packages/import-export"),
			project("marketplace", "packages/marketplace"),
			project("platform", "packages/platform"),
			project("plugin-host-core", "packages/plugin-host-core"),
			project("properties", "packages/properties", domProject),
			project("renderer", "packages/renderer"),
			project("search", "packages/search"),
			project("settings", "packages/settings"),
			project("sync-engine", "packages/sync-engine", { passWithNoTests: true }),
			project("templates", "packages/templates"),
			project("ui", "packages/ui"),
		],
	},
})
