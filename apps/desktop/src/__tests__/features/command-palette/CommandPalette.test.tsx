import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	useUIStore: vi.fn(),
}))

vi.mock("@cortex/hotkeys", () => ({
	formatHotkeyDisplay: vi.fn((keys: string) => keys.replace("mod", "mod")),
	useHotkeysStore: vi.fn(),
}))

vi.mock("@cortex/commands", () => ({
	executeCommand: vi.fn(),
	getCommands: vi.fn(),
}))

import { executeCommand, getCommands } from "@cortex/commands"
import { useUIStore } from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { CommandPalette } from "../../../features/command-palette/CommandPalette"

const toggleCommandPalette = vi.fn()

function setupCommandPalette() {
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		callback(0)
		return 0
	})

	vi.mocked(useUIStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			commandPaletteOpen: true,
			toggleCommandPalette,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useHotkeysStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			bindings: [{ id: "workspace.open-settings", keys: "mod+," }],
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(getCommands).mockReturnValue([
		{
			id: "workspace.open-settings",
			label: "Open Settings",
			category: "Workspace",
			execute: vi.fn(),
		},
	] as never)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.unstubAllGlobals()
})

describe("CommandPalette", () => {
	it("executes a command and closes the palette", async () => {
		setupCommandPalette()
		render(<CommandPalette />)

		await userEvent.click(screen.getByText("Open Settings"))

		expect(toggleCommandPalette).toHaveBeenCalled()
		await waitFor(() => {
			expect(executeCommand).toHaveBeenCalledWith("workspace.open-settings", {
				source: "palette",
			})
		})
		expect(screen.getByText("mod+,")).toBeInTheDocument()
		expect(screen.getByText("run")).toBeInTheDocument()
	})
})
