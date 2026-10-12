import { type CommandEntry, commandRegistry } from "@cortex/commands"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useHotkeysStore } from "./hotkeysStore"

function command(
	id: string,
	category: string,
	defaultKeys: string,
	scope: "global" | "editor" = "global",
	execute: CommandEntry["execute"] = () => {},
): CommandEntry {
	return {
		id,
		label: id === "plugin:command" ? "Plugin Command" : `${category} Command`,
		category,
		hotkey: { defaultKeys, scope },
		execute,
	}
}

const platform = {
	fs: {
		readFile: vi.fn(async () =>
			JSON.stringify({
				"plugin:command": {
					keys: "mod+shift+p",
					enabled: false,
				},
			}),
		),
		writeFile: vi.fn(),
	},
}

vi.mock("@cortex/platform", () => ({
	getPlatform: () => platform,
}))

beforeEach(() => {
	useHotkeysStore.setState({
		bindings: [],
		parsedBindings: [],
		overrides: {},
	})
	commandRegistry.clear()
	platform.fs.readFile.mockClear()
	platform.fs.writeFile.mockClear()
})

describe("useHotkeysStore", () => {
	it("applies loaded overrides to command bindings added later", async () => {
		await useHotkeysStore.getState().loadOverrides("/vault")

		useHotkeysStore.getState().syncCommands([command("plugin:command", "Plugin", "mod+p")])

		expect(
			useHotkeysStore.getState().bindings.find((binding) => binding.id === "plugin:command"),
		).toEqual({
			id: "plugin:command",
			label: "Plugin Command",
			category: "Plugin",
			scope: "global",
			defaultKeys: "mod+p",
			keys: "mod+shift+p",
			enabled: false,
		})
	})

	it("preserves overrides for commands that are not currently registered", async () => {
		await useHotkeysStore.getState().loadOverrides("/vault")

		useHotkeysStore.getState().syncCommands([command("app.command", "App", "mod+a")])
		useHotkeysStore.getState().updateBinding("app.command", "mod+shift+a")
		await useHotkeysStore.getState().saveOverrides("/vault")

		expect(platform.fs.writeFile).toHaveBeenCalledWith(
			"/vault/.cortex/hotkeys.json",
			JSON.stringify(
				{
					"plugin:command": {
						keys: "mod+shift+p",
						enabled: false,
					},
					"app.command": {
						keys: "mod+shift+a",
						enabled: true,
					},
				},
				null,
				"\t",
			),
		)
	})

	it("dispatches only global scoped enabled bindings", () => {
		const globalHandler = vi.fn()
		const editorHandler = vi.fn()
		const commands = [
			command("editor.command", "Editor", "mod+a", "editor", editorHandler),
			command("app.command", "App", "mod+a", "global", globalHandler),
		]
		commandRegistry.registerMany(commands)
		useHotkeysStore.getState().syncCommands(commands)

		const event = {
			key: "a",
			ctrlKey: true,
			metaKey: false,
			shiftKey: false,
			altKey: false,
			preventDefault: vi.fn(),
		} as unknown as KeyboardEvent

		expect(useHotkeysStore.getState().handleKeyEvent(event)).toBe(true)
		expect(globalHandler).toHaveBeenCalled()
		expect(editorHandler).not.toHaveBeenCalled()
	})
})
