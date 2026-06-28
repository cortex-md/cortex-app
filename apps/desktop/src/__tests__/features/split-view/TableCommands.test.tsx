import { EditorState } from "@codemirror/state"
import { commandRegistry } from "@cortex/commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { pluginStore } from "@cortex/plugin-host-core"
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EditorContextMenu } from "../../../features/split-view/EditorContextMenu"
import { useAppCommands } from "../../../hooks/useAppCommands"

const openMarketplaceView = vi.hoisted(() => vi.fn())

vi.mock("../../../features/marketplace/openMarketplaceView", () => ({
	openMarketplaceView,
}))

const tableCommandIds = [
	"table.align-left",
	"table.align-center",
	"table.align-right",
	"table.duplicate-row",
	"table.duplicate-column",
	"table.move-row-up",
	"table.move-row-down",
	"table.move-column-left",
	"table.move-column-right",
	"table.add-row-end",
	"table.add-column-end",
	"table.copy-markdown",
	"table.copy-tsv",
	"table.copy-row-tsv",
	"table.copy-column-tsv",
	"table.copy-selection-tsv",
	"table.clear-selection",
]

function createEditorView(content: string, selection: number): EditorRuntimeView {
	return {
		dom: document.createElement("div"),
		state: EditorState.create({
			doc: content,
			selection: { anchor: selection },
		}),
		dispatch: vi.fn(),
		focus: vi.fn(),
	} as unknown as EditorRuntimeView
}

beforeEach(() => {
	commandRegistry.clear()
	pluginStore.getState().reset()
})

afterEach(() => {
	cleanup()
	commandRegistry.clear()
	vi.clearAllMocks()
})

describe("table command surfaces", () => {
	it("registers the Marketplace workspace command", () => {
		renderHook(() => useAppCommands())

		const command = commandRegistry.get("marketplace.open")

		expect(command?.category).toBe("App")
		expect(command?.aliases).toEqual(
			expect.arrayContaining(["marketplace", "browse-plugins", "browse-themes"]),
		)
		expect(commandRegistry.execute("marketplace.open", { source: "test" })).toBe(true)
		expect(openMarketplaceView).toHaveBeenCalledWith("plugins")
	})

	it("registers table commands for palette and Vim names", () => {
		renderHook(() => useAppCommands())

		for (const commandId of tableCommandIds) {
			const command = commandRegistry.get(commandId)
			expect(command?.category).toBe("Table")
			expect(command?.execute).toEqual(expect.any(Function))
		}

		const vimNames = commandRegistry
			.getVimChoices()
			.filter((choice) => tableCommandIds.includes(choice.commandId))
			.map((choice) => choice.name)

		expect(vimNames).toEqual(
			expect.arrayContaining([
				"table_align_left",
				"align_column_left",
				"table_add_row_end",
				"table_copy_markdown",
				"copy_table_markdown",
				"table_copy_selection_tsv",
				"clear_selection",
			]),
		)
	})

	it("shows table actions in the fallback context menu only inside a table", async () => {
		const table = "| A | B |\n| --- | --- |\n| C | D |"
		const tableView = createEditorView(table, table.indexOf("A"))

		render(
			<EditorContextMenu getEditorView={() => tableView}>
				<div data-testid="editor-surface">Editor</div>
			</EditorContextMenu>,
		)

		fireEvent.contextMenu(screen.getByTestId("editor-surface"), { clientX: 10, clientY: 10 })

		await waitFor(() => {
			expect(screen.getByText("Align Column")).toBeInTheDocument()
		})
		expect(screen.getByText("Add Row at End")).toBeInTheDocument()
		expect(screen.getByText("Duplicate Row")).toBeInTheDocument()
		expect(screen.getByText("Move Column Right")).toBeInTheDocument()
		expect(screen.getByText("Copy")).toBeInTheDocument()

		cleanup()

		const plainView = createEditorView("plain text", 0)
		render(
			<EditorContextMenu getEditorView={() => plainView}>
				<div data-testid="plain-editor-surface">Editor</div>
			</EditorContextMenu>,
		)

		fireEvent.contextMenu(screen.getByTestId("plain-editor-surface"), {
			clientX: 10,
			clientY: 10,
		})

		await waitFor(() => {
			expect(screen.getByText("Insert")).toBeInTheDocument()
		})
		expect(screen.queryByText("Align Column")).not.toBeInTheDocument()
		expect(screen.queryByText("Duplicate Row")).not.toBeInTheDocument()
		expect(screen.queryByText("Move Column Right")).not.toBeInTheDocument()
	})

	it("shows editor plugin actions as flat menu items", async () => {
		const pluginAction = vi.fn()
		pluginStore.getState().addContextMenuItem("alpha", {
			id: "run-action",
			label: "Run plugin action",
			location: "editor",
			action: pluginAction,
		})
		const plainView = createEditorView("plain text", 0)

		render(
			<EditorContextMenu getEditorView={() => plainView}>
				<div data-testid="editor-surface">Editor</div>
			</EditorContextMenu>,
		)

		fireEvent.contextMenu(screen.getByTestId("editor-surface"), { clientX: 10, clientY: 10 })

		await waitFor(() => {
			expect(screen.getByText("Run plugin action")).toBeInTheDocument()
		})
		expect(screen.queryByText("Plugins")).not.toBeInTheDocument()

		fireEvent.click(screen.getByText("Run plugin action"))

		expect(pluginAction).toHaveBeenCalledWith({
			location: "editor",
			filePath: null,
			selection: { from: 0, to: 0 },
		})
	})

	it("uses the table cell under the context menu as the action target", async () => {
		const table = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const tableView = createEditorView(table, table.indexOf("tail"))

		render(
			<EditorContextMenu getEditorView={() => tableView}>
				<div data-testid="editor-surface">
					<span
						className="cm-table-cell"
						data-table-cell-cursor={table.indexOf("B")}
						data-testid="table-cell"
					>
						B
					</span>
				</div>
			</EditorContextMenu>,
		)
		;(tableView as unknown as { dom: HTMLElement }).dom = screen.getByTestId("editor-surface")

		fireEvent.contextMenu(screen.getByTestId("table-cell"), { clientX: 10, clientY: 10 })

		await waitFor(() => {
			expect(screen.getByText("Align Column")).toBeInTheDocument()
		})

		fireEvent.click(screen.getByText("Add Column Right"))

		expect(tableView.dispatch).toHaveBeenCalledWith({
			selection: { anchor: table.indexOf("B") },
		})
	})
})
