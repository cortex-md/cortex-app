import type { SlashCommandMenuState } from "@cortex/editor/slash-commands"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, type Mock, vi } from "vitest"
import { SlashCommandMenu } from "../../../features/split-view/SlashCommandMenu"

const select = vi.fn()
const execute = vi.fn()
const dismiss = vi.fn()

function createMenuState(selectedIndex = 0): SlashCommandMenuState {
	return {
		query: "",
		selectedIndex,
		position: {
			top: 80,
			left: 120,
			placement: "bottom",
		},
		items: [
			{
				id: "format.bold",
				label: "Bold",
				category: "Format",
				aliases: ["bold"],
				shortcut: "Ctrl+B",
			},
			{
				id: "format.heading-2",
				label: "Heading 2",
				category: "Format",
				aliases: ["heading-2"],
				shortcut: "Alt+2",
			},
		],
		select,
		execute,
		dismiss,
	}
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("SlashCommandMenu", () => {
	it("renders markdown command icons without shortcut text", () => {
		render(<SlashCommandMenu state={createMenuState()} />)

		expect(screen.getByText("Bold")).toBeInTheDocument()
		expect(screen.getByText("Heading 2")).toBeInTheDocument()
		expect(document.querySelector('[data-slash-command-icon="format.bold"]')).not.toBeNull()
		expect(document.querySelector('[data-slash-command-icon="format.heading-2"]')).not.toBeNull()
		expect(screen.queryByText("Ctrl+B")).not.toBeInTheDocument()
		expect(screen.queryByText("Alt+2")).not.toBeInTheDocument()
	})

	it("keeps the active command visible as keyboard selection changes", () => {
		const scrollIntoView = Element.prototype.scrollIntoView as Mock
		const { rerender } = render(<SlashCommandMenu state={createMenuState(0)} />)
		scrollIntoView.mockClear()

		rerender(<SlashCommandMenu state={createMenuState(1)} />)

		expect(scrollIntoView).toHaveBeenCalledTimes(1)
		expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" })
	})

	it("keeps cmdk selection aligned with the active slash command", () => {
		render(<SlashCommandMenu state={createMenuState(1)} />)

		const boldItem = screen.getByText("Bold").closest('[data-slot="command-item"]')
		const headingItem = screen.getByText("Heading 2").closest('[data-slot="command-item"]')

		expect(boldItem).not.toHaveAttribute("data-active", "true")
		expect(boldItem).not.toHaveAttribute("data-selected", "true")
		expect(headingItem).toHaveAttribute("data-active", "true")
		expect(headingItem).toHaveAttribute("data-selected", "true")
	})
})
