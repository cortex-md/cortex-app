import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DrawingBoard } from "../../../features/drawings/DrawingBoard"
import { createEmptyDrawingDocument } from "../../../features/drawings/drawingDocument"

const readDrawingDocumentFromNote = vi.hoisted(() => vi.fn())
const writeDrawingDocumentToNote = vi.hoisted(() => vi.fn())
const excalidrawChange = vi.hoisted(
	() =>
		({
			current: null as ((elements: unknown, appState: unknown, files: unknown) => void) | null,
		}) as {
			current: ((elements: unknown, appState: unknown, files: unknown) => void) | null
		},
)

vi.mock("../../../features/drawings/drawingDocument", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../features/drawings/drawingDocument")>()
	return {
		...actual,
		readDrawingDocumentFromNote,
		writeDrawingDocumentToNote,
	}
})

vi.mock("@excalidraw/excalidraw/index.css", () => ({}))

vi.mock("@excalidraw/excalidraw", () => ({
	Excalidraw: ({ onChange }: { onChange: typeof excalidrawChange.current }) => {
		excalidrawChange.current = onChange
		return <div data-testid="excalidraw-canvas" />
	},
	restore: vi.fn((data) => data),
	getSceneVersion: vi.fn((elements: { version?: number }) => elements.version ?? 0),
	serializeAsJSON: vi.fn((elements, appState, files) =>
		JSON.stringify({
			type: "excalidraw",
			version: 2,
			source: "test",
			elements,
			appState,
			files,
		}),
	),
}))

beforeEach(() => {
	readDrawingDocumentFromNote.mockResolvedValue(createEmptyDrawingDocument("Drawing", "draw-1"))
	writeDrawingDocumentToNote.mockResolvedValue(true)
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.clearAllMocks()
	excalidrawChange.current = null
})

describe("DrawingBoard", () => {
	it("debounces drawing writes and dedupes unchanged scene versions", async () => {
		render(<DrawingBoard filePath="/vault/Note.md" drawingId="draw-1" />)

		await screen.findByTestId("excalidraw-canvas")

		vi.useFakeTimers()
		act(() => {
			excalidrawChange.current?.([{ id: "one", version: 1 }], { viewBackgroundColor: "#fff" }, {})
			vi.advanceTimersByTime(999)
		})

		expect(writeDrawingDocumentToNote).not.toHaveBeenCalled()

		await act(async () => {
			vi.advanceTimersByTime(1)
			await Promise.resolve()
		})

		expect(writeDrawingDocumentToNote).toHaveBeenCalledTimes(1)
		expect(writeDrawingDocumentToNote.mock.calls[0][0]).toBe("/vault/Note.md")
		expect(writeDrawingDocumentToNote.mock.calls[0][1]).toBe("draw-1")
		expect(writeDrawingDocumentToNote.mock.calls[0][3]).toEqual({ flush: false })

		act(() => {
			excalidrawChange.current?.([{ id: "same", version: 1 }], { viewBackgroundColor: "#fff" }, {})
			vi.advanceTimersByTime(1000)
		})

		expect(writeDrawingDocumentToNote).toHaveBeenCalledTimes(1)
		vi.useRealTimers()
	})

	it("flushes a pending drawing write when unmounted", async () => {
		const { unmount } = render(<DrawingBoard filePath="/vault/Note.md" drawingId="draw-1" />)

		await screen.findByTestId("excalidraw-canvas")

		act(() => {
			excalidrawChange.current?.([{ id: "two", version: 2 }], { viewBackgroundColor: "#fff" }, {})
		})

		unmount()

		await waitFor(() => {
			expect(writeDrawingDocumentToNote).toHaveBeenCalledWith(
				"/vault/Note.md",
				"draw-1",
				expect.objectContaining({ id: "draw-1" }),
				{ flush: true },
			)
		})
	})
})
