import { commandRegistry, registerCommand } from "@cortex/commands"
import { useVaultStore } from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { getPlatform } from "@cortex/platform"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeCommandHotkeyBridge } from "../../../bootstrap/commandHotkeyBridge"
import { HotkeysSection } from "../../../features/settings/HotkeysSettings"

function resetHotkeysStore() {
	useHotkeysStore.setState({
		bindings: [],
		parsedBindings: [],
		handlers: {},
		overrides: {},
	})
}

function configurePlatform() {
	const platform = {
		storage: {
			getVaultConfigDir: vi.fn().mockResolvedValue("/vault/.cortex"),
		},
		fs: {
			readFile: vi.fn().mockRejectedValue(new Error("missing")),
			writeFile: vi.fn().mockResolvedValue(undefined),
		},
	}
	vi.mocked(getPlatform).mockReturnValue(platform as never)
	return platform
}

beforeEach(() => {
	initializeCommandHotkeyBridge()
	commandRegistry.clear()
	resetHotkeysStore()
	useVaultStore.setState({
		vault: {
			uuid: "vault",
			path: "/vault",
			name: "Vault",
			fileCount: 0,
		},
	})
	configurePlatform()
})

afterEach(() => {
	cleanup()
	commandRegistry.clear()
	resetHotkeysStore()
	vi.clearAllMocks()
})

describe("HotkeysSection", () => {
	it("shows plugin commands without hotkeys as assignable commands with Vim names", () => {
		registerCommand({
			id: "note-pulse:open-report",
			label: "Open Note Pulse Report",
			category: "Note Pulse",
			execute: vi.fn(),
		})

		render(<HotkeysSection />)

		expect(screen.getByText("Open Note Pulse Report")).toBeInTheDocument()
		expect(screen.getByText(":note_pulse_open_report")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Add shortcut" })).toHaveTextContent("Unassigned")
	})

	it("records and saves a shortcut for a plugin command without a default hotkey", async () => {
		const user = userEvent.setup()
		const platform = configurePlatform()
		registerCommand({
			id: "note-pulse:open-report",
			label: "Open Note Pulse Report",
			category: "Note Pulse",
			execute: vi.fn(),
		})

		render(<HotkeysSection />)

		await user.click(screen.getByRole("button", { name: "Add shortcut" }))
		fireEvent.keyDown(window, { key: "p", ctrlKey: true, shiftKey: true })

		await waitFor(() => {
			expect(platform.fs.writeFile).toHaveBeenCalledWith(
				"/vault/.cortex/hotkeys.json",
				expect.stringContaining("mod+shift+p"),
			)
		})
		expect(screen.getByRole("button", { name: "Change shortcut" })).toHaveTextContent(
			"Ctrl+Shift+P",
		)
	})
})
