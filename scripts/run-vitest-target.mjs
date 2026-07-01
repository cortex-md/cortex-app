import { spawnSync } from "node:child_process"

const targets = {
	desktop: [
		"packages/commands",
		"packages/templates",
		"packages/properties",
		"packages/databases",
		"packages/core",
		"packages/platform",
		"packages/ipc",
		"packages/settings",
		"packages/hotkeys",
		"packages/editor",
		"packages/renderer",
		"packages/plugin-host-core",
		"packages/plugin-host-web",
		"packages/marketplace",
		"packages/search",
		"packages/ui",
		"apps/desktop",
	],
}

const [, , targetName] = process.argv
const workspaces = targets[targetName]

if (!workspaces) {
	console.error("Usage: bun scripts/run-vitest-target.mjs <target>")
	process.exit(1)
}

for (const workspace of workspaces) {
	const result = spawnSync("bun", ["run", "--cwd", workspace, "vitest", "run"], {
		stdio: "inherit",
		shell: process.platform === "win32",
	})

	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
}
