import { spawnSync } from "node:child_process"

const targets = {
	desktop: [
		"apps/desktop",
		"packages/commands",
		"packages/core",
		"packages/editor",
		"packages/hotkeys",
		"packages/ipc",
		"packages/marketplace",
		"packages/platform",
		"packages/plugin-api",
		"packages/plugin-host-core",
		"packages/plugin-host-web",
		"packages/properties",
		"packages/renderer",
		"packages/search",
		"packages/settings",
		"packages/templates",
		"packages/theme",
		"packages/ui",
		"plugins/github-emoji",
		"scripts/run-biome-target.mjs",
		"scripts/run-vitest-target.mjs",
		"tools/benchmarks",
		"AGENTS.md",
		"biome.json",
		"package.json",
		"tsconfig.desktop.json",
		"tsconfig.json",
	],
}

const [, , targetName, command, ...flags] = process.argv
const paths = targets[targetName]

if (!paths || !command) {
	console.error("Usage: bun scripts/run-biome-target.mjs <target> <lint|format|check> [...flags]")
	process.exit(1)
}

const result = spawnSync("biome", [command, ...flags, ...paths], {
	stdio: "inherit",
	shell: process.platform === "win32",
})

process.exit(result.status ?? 1)
