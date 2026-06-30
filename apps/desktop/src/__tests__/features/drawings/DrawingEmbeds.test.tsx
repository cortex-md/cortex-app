import { EditorState } from "@codemirror/state"
import { commandRegistry } from "@cortex/commands"
import type { ParsedCodeBlockEmbed } from "@cortex/editor/code-block-embeds"
import { parseFencedCodeBlocks } from "@cortex/editor/code-block-embeds"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { cleanup, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DrawingEmbedCard } from "../../../features/drawings/DrawingEmbedCard"
import { insertDrawingBlock } from "../../../features/drawings/drawingCommands"
import {
	createEmptyDrawingDocument,
	DRAWING_FENCE_LANGUAGE,
	parseDrawingDocument,
	serializeDrawingDocument,
} from "../../../features/drawings/drawingDocument"
import { useAppCommands } from "../../../hooks/useAppCommands"

const openDrawingModal = vi.hoisted(() => vi.fn())
const openDrawingBoardTab = vi.hoisted(() => vi.fn())
const openMarketplaceView = vi.hoisted(() => vi.fn())

vi.mock("../../../features/drawings/drawingModalStore", () => ({
	openDrawingModal,
}))

vi.mock("../../../features/drawings/drawingWorkspace", () => ({
	openDrawingBoardTab,
}))

vi.mock("../../../features/marketplace/openMarketplaceView", () => ({
	openMarketplaceView,
}))

function createBlock(content: string): ParsedCodeBlockEmbed {
	return {
		language: DRAWING_FENCE_LANGUAGE,
		info: DRAWING_FENCE_LANGUAGE,
		content,
		sourceFrom: 0,
		sourceTo: content.length,
		contentFrom: 0,
		contentTo: content.length,
		openingFenceFrom: 0,
		openingFenceTo: 0,
		closingFenceFrom: null,
		closingFenceTo: null,
		fence: "```",
		fenceChar: "`",
	}
}

function createEditorView(content: string, selection: number): EditorRuntimeView {
	return {
		state: EditorState.create({
			doc: content,
			selection: { anchor: selection },
		}),
		dispatch: vi.fn(),
	} as unknown as EditorRuntimeView
}

beforeEach(() => {
	commandRegistry.clear()
})

afterEach(() => {
	cleanup()
	commandRegistry.clear()
	vi.clearAllMocks()
})

describe("drawing embeds", () => {
	it("inserts a valid cortex-draw fence and opens the drawing modal", () => {
		const view = createEditorView("Alpha", 5)

		expect(insertDrawingBlock(view, "/vault/Note.md")).toBe(true)

		const dispatched = vi.mocked(view.dispatch).mock.calls[0][0] as {
			changes: { insert: string }
		}
		expect(dispatched.changes.insert).toContain(`\`\`\`${DRAWING_FENCE_LANGUAGE}`)
		const block = parseFencedCodeBlocks(dispatched.changes.insert, [DRAWING_FENCE_LANGUAGE])[0]
		const document = parseDrawingDocument(block.content)

		expect(document).toMatchObject({
			schema: "cortex.drawing",
			version: 1,
			engine: "excalidraw",
			title: "Drawing",
		})
		expect(openDrawingModal).toHaveBeenCalledWith({
			filePath: "/vault/Note.md",
			drawingId: document?.id,
		})
	})

	it("renders a lightweight drawing card with modal and tab actions", async () => {
		const document = createEmptyDrawingDocument("System Sketch", "draw-1")

		render(
			<DrawingEmbedCard
				filePath="/vault/Note.md"
				block={createBlock(serializeDrawingDocument(document))}
			/>,
		)

		expect(screen.getByText("System Sketch")).toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: /open/i }))
		expect(openDrawingModal).toHaveBeenCalledWith({
			filePath: "/vault/Note.md",
			drawingId: "draw-1",
		})

		await userEvent.click(screen.getByRole("button", { name: /tab/i }))
		expect(openDrawingBoardTab).toHaveBeenCalledWith("/vault/Note.md", "draw-1", "System Sketch")
	})

	it("renders corrupt drawing data without wiring destructive actions", () => {
		render(<DrawingEmbedCard filePath="/vault/Note.md" block={createBlock("{bad json")} />)

		expect(screen.getByText("Drawing unavailable")).toBeInTheDocument()
		expect(screen.queryByRole("button")).not.toBeInTheDocument()
	})

	it("registers the drawing command for command surfaces", () => {
		renderHook(() => useAppCommands())

		const command = commandRegistry.get("format.drawing")

		expect(command).toMatchObject({
			id: "format.drawing",
			label: "Insert Drawing",
			category: "Format",
			aliases: expect.arrayContaining(["drawing", "draw", "excalidraw", "whiteboard"]),
		})
	})
})
