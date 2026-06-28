import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../../noteCache"
import { useEditorStore } from "../../stores/editorStore"

const initialState = {
	activeFilePath: null,
	mode: "live-preview" as const,
	cursor: null,
}

beforeEach(() => {
	useEditorStore.setState(initialState)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("setActiveFile()", () => {
	it("sets the active file path", () => {
		useEditorStore.getState().setActiveFile("/vault/note.md")
		expect(useEditorStore.getState().activeFilePath).toBe("/vault/note.md")
	})

	it("clears cursor when setting a new file", () => {
		useEditorStore.getState().updateCursor({ line: 5, col: 3, offset: 50 })
		useEditorStore.getState().setActiveFile("/vault/other.md")
		expect(useEditorStore.getState().cursor).toBeNull()
	})

	it("accepts null to clear the active file", () => {
		useEditorStore.getState().setActiveFile("/vault/note.md")
		useEditorStore.getState().setActiveFile(null)
		expect(useEditorStore.getState().activeFilePath).toBeNull()
	})
})

describe("updateCursor()", () => {
	it("stores cursor position with line, col, and offset", () => {
		useEditorStore.getState().updateCursor({ line: 10, col: 5, offset: 100 })
		expect(useEditorStore.getState().cursor).toEqual({ line: 10, col: 5, offset: 100 })
	})

	it("overwrites previous cursor on subsequent calls", () => {
		useEditorStore.getState().updateCursor({ line: 1, col: 1, offset: 0 })
		useEditorStore.getState().updateCursor({ line: 20, col: 3, offset: 200 })
		expect(useEditorStore.getState().cursor?.line).toBe(20)
	})
})

describe("setMode()", () => {
	it("sets mode to source", () => {
		useEditorStore.getState().setMode("source")
		expect(useEditorStore.getState().mode).toBe("source")
	})

	it("sets mode to live-preview", () => {
		useEditorStore.getState().setMode("live-preview")
		expect(useEditorStore.getState().mode).toBe("live-preview")
	})

	it("sets mode to reading", () => {
		useEditorStore.getState().setMode("reading")
		expect(useEditorStore.getState().mode).toBe("reading")
	})

	it("sets mode to side-by-side", () => {
		useEditorStore.getState().setMode("side-by-side")
		expect(useEditorStore.getState().mode).toBe("side-by-side")
	})
})

describe("flushActive()", () => {
	it("calls noteCache.flush with the active file path", async () => {
		const flushSpy = vi.spyOn(noteCache, "flush").mockResolvedValue()
		useEditorStore.getState().setActiveFile("/vault/note.md")
		await useEditorStore.getState().flushActive()
		expect(flushSpy).toHaveBeenCalledWith("/vault/note.md")
	})

	it("is a no-op when no file is active", async () => {
		const flushSpy = vi.spyOn(noteCache, "flush").mockResolvedValue()
		await useEditorStore.getState().flushActive()
		expect(flushSpy).not.toHaveBeenCalled()
	})
})
