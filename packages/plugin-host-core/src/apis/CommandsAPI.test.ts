import { commandRegistry } from "@cortex/commands"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { pluginStore } from "../pluginStore"
import { createCommandsAPI } from "./CommandsAPI"

beforeEach(() => {
	commandRegistry.clear()
	pluginStore.getState().reset()
	pluginStore.getState().registerPlugin({
		id: "daily-tools",
		name: "Daily Tools",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Test plugin",
		icon: "calendar",
		main: "index.ts",
		capabilities: ["commands"],
	})
})

describe("createCommandsAPI", () => {
	it("registers prefixed plugin commands with aliases and default hotkeys", () => {
		const execute = vi.fn()
		const api = createCommandsAPI("daily-tools")
		const disposable = api.register({
			id: "open-today",
			label: "Open Today",
			category: "Daily",
			aliases: ["today"],
			defaultHotkey: "mod+d",
			execute,
		})

		const command = commandRegistry.get("daily-tools:open-today")

		expect(command).toMatchObject({
			id: "daily-tools:open-today",
			label: "Open Today",
			category: "Daily",
			aliases: ["today"],
			hotkey: {
				defaultKeys: "mod+d",
				scope: "global",
				enabled: true,
			},
		})
		expect(api.execute("open-today")).toBe(true)
		expect(execute).toHaveBeenCalled()

		disposable.dispose()

		expect(commandRegistry.get("daily-tools:open-today")).toBeUndefined()
	})
})
