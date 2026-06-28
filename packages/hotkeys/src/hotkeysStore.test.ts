import { beforeEach, describe, expect, it, vi } from "vitest"
import { useHotkeysStore } from "./hotkeysStore"

const platform = {
	storage: {
		getVaultConfigDir: vi.fn(async () => "/vault/.cortex"),
	},
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
		handlers: {},
		overrides: {},
	})
	platform.storage.getVaultConfigDir.mockClear()
	platform.fs.readFile.mockClear()
	platform.fs.writeFile.mockClear()
})

describe("useHotkeysStore", () => {
	it("applies loaded overrides to command bindings added later", async () => {
		await useHotkeysStore.getState().loadOverrides("/vault")

		useHotkeysStore.getState().addBinding({
			id: "plugin:command",
			label: "Plugin Command",
			category: "Plugin",
			scope: "global",
			defaultKeys: "mod+p",
			keys: "mod+p",
			enabled: true,
		})

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

		useHotkeysStore.getState().addBinding({
			id: "app.command",
			label: "App Command",
			category: "App",
			scope: "global",
			defaultKeys: "mod+a",
			keys: "mod+a",
			enabled: true,
		})
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
		useHotkeysStore.getState().addBinding({
			id: "app.command",
			label: "App Command",
			category: "App",
			scope: "global",
			defaultKeys: "mod+a",
			keys: "mod+a",
			enabled: true,
		})
		useHotkeysStore.getState().addBinding({
			id: "editor.command",
			label: "Editor Command",
			category: "Editor",
			scope: "editor",
			defaultKeys: "mod+a",
			keys: "mod+a",
			enabled: true,
		})
		useHotkeysStore.getState().registerHandler("app.command", globalHandler)
		useHotkeysStore.getState().registerHandler("editor.command", editorHandler)

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
