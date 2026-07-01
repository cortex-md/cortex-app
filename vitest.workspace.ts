import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { defineWorkspace } from "vitest/config"

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineWorkspace([
	{
		plugins: [react()],
		test: {
			name: "desktop",
			root: path.join(workspaceRoot, "apps/desktop"),
			environment: "jsdom",
			globals: true,
			setupFiles: [path.join(workspaceRoot, "apps/desktop/src/__tests__/setup.ts")],
			include: ["src/**/*.test.{ts,tsx}"],
		},
	},
	{
		test: {
			name: "databases",
			root: path.join(workspaceRoot, "packages/databases"),
			environment: "node",
			globals: true,
			include: ["src/**/*.test.{ts,tsx}"],
		},
	},
	{
		test: {
			name: "core",
			root: path.join(workspaceRoot, "packages/core"),
			environment: "node",
			globals: true,
			setupFiles: [path.join(workspaceRoot, "packages/core/src/__tests__/setup.ts")],
			include: ["src/**/*.test.{ts,tsx}"],
		},
	},
	{
		test: {
			name: "settings",
			root: path.join(workspaceRoot, "packages/settings"),
			environment: "node",
			globals: true,
			include: ["src/**/*.test.{ts,tsx}"],
		},
	},
])
