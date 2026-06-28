import { commandRegistry, registerCommand } from "@cortex/commands"
import { useHotkeysStore } from "@cortex/hotkeys"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeCommandHotkeyBridge } from "../../bootstrap/commandHotkeyBridge"

function resetHotkeysStore() {
	useHotkeysStore.setState({
		bindings: [],
		parsedBindings: [],
		handlers: {},
		overrides: {},
	})
}

function createModKeyEvent(key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent {
	return {
		key,
		ctrlKey: true,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		preventDefault: vi.fn(),
		...options,
	} as unknown as KeyboardEvent
}

beforeEach(() => {
	initializeCommandHotkeyBridge()
	commandRegistry.clear()
	resetHotkeysStore()
})

afterEach(() => {
	commandRegistry.clear()
	resetHotkeysStore()
	vi.clearAllMocks()
})

describe("command hotkey bridge", () => {
	it("mirrors commands without default hotkeys as assignable global bindings", () => {
		registerCommand({
			id: "note-pulse:open-report",
			label: "Open Note Pulse Report",
			category: "Note Pulse",
			execute: vi.fn(),
		})

		expect(
			useHotkeysStore
				.getState()
				.bindings.find((binding) => binding.id === "note-pulse:open-report"),
		).toEqual({
			id: "note-pulse:open-report",
			label: "Open Note Pulse Report",
			category: "Note Pulse",
			scope: "global",
			defaultKeys: "",
			keys: "",
			enabled: true,
		})
	})

	it("executes an unassigned command after the user records a global hotkey", () => {
		const execute = vi.fn()
		registerCommand({
			id: "note-pulse:open-report",
			label: "Open Note Pulse Report",
			category: "Note Pulse",
			execute,
		})

		useHotkeysStore.getState().updateBinding("note-pulse:open-report", "mod+shift+p")

		expect(
			useHotkeysStore.getState().handleKeyEvent(createModKeyEvent("p", { shiftKey: true })),
		).toBe(true)
		expect(execute).toHaveBeenCalledWith({ source: "hotkey" })
	})

	it("removes mirrored bindings when commands unregister", () => {
		const unregister = registerCommand({
			id: "note-pulse:open-report",
			label: "Open Note Pulse Report",
			category: "Note Pulse",
			execute: vi.fn(),
		})

		expect(
			useHotkeysStore
				.getState()
				.bindings.some((binding) => binding.id === "note-pulse:open-report"),
		).toBe(true)

		unregister()

		expect(
			useHotkeysStore
				.getState()
				.bindings.some((binding) => binding.id === "note-pulse:open-report"),
		).toBe(false)
	})

	it("preserves declared default hotkeys and scopes", () => {
		registerCommand({
			id: "editor.bold",
			label: "Bold",
			category: "Format",
			hotkey: { defaultKeys: "mod+b", scope: "editor", enabled: true },
			execute: vi.fn(),
		})

		expect(useHotkeysStore.getState().bindings[0]).toEqual({
			id: "editor.bold",
			label: "Bold",
			category: "Format",
			scope: "editor",
			defaultKeys: "mod+b",
			keys: "mod+b",
			enabled: true,
		})
		expect(useHotkeysStore.getState().handlers["editor.bold"]).toBeUndefined()
	})
})
