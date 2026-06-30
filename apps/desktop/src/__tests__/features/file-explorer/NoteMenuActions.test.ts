import { describe, expect, it, vi } from "vitest"
import {
	buildNoteMenuItems,
	type NoteMenuActions,
} from "../../../features/file-explorer/NativeMenuActions"

function createActions(): NoteMenuActions {
	return {
		openInNewTab: vi.fn(),
		openInRightSplit: vi.fn(),
		duplicate: vi.fn(),
		exportNote: vi.fn(),
		copyRelativePath: vi.fn(),
		copyAbsolutePath: vi.fn(),
		reveal: vi.fn(),
		showVersionHistory: vi.fn(),
		toggleBookmark: vi.fn(),
		toggleSyncIgnore: vi.fn(),
		rename: vi.fn(),
		delete: vi.fn(),
	}
}

describe("note menu actions", () => {
	it("keeps the shared action order and copy path submenu", () => {
		const items = buildNoteMenuItems(
			{
				path: "/vault/note.md",
				bookmarked: false,
				syncIgnored: false,
				showVersionHistory: true,
				canToggleSync: true,
			},
			createActions(),
		)

		expect(items.map((item) => (item.type === "separator" ? "separator" : item.id))).toEqual([
			"open-new-tab",
			"open-right-split",
			"separator",
			"make-copy",
			"export-note",
			"copy-path",
			"reveal",
			"add-bookmark",
			"separator",
			"version-history",
			"exclude-from-sync",
			"separator",
			"rename",
			"separator",
			"delete",
		])
		const copyPath = items.find((item) => item.type === "submenu" && item.id === "copy-path")
		expect(
			copyPath?.type === "submenu"
				? copyPath.items.map((item) => (item.type === "separator" ? "separator" : item.id))
				: [],
		).toEqual(["copy-relative-path", "copy-absolute-path"])
	})

	it("omits sync-only actions and marks delete as destructive", () => {
		const items = buildNoteMenuItems(
			{
				path: "/vault/note.md",
				bookmarked: false,
				syncIgnored: false,
				showVersionHistory: false,
				canToggleSync: false,
			},
			createActions(),
		)

		expect(items.some((item) => item.type !== "separator" && item.id === "version-history")).toBe(
			false,
		)
		expect(items.find((item) => item.type !== "separator" && item.id === "delete")).toEqual(
			expect.objectContaining({ destructive: true }),
		)
	})

	it("uses the remove bookmark action when the note is already bookmarked", () => {
		const items = buildNoteMenuItems(
			{
				path: "/vault/note.md",
				bookmarked: true,
				syncIgnored: false,
				showVersionHistory: false,
				canToggleSync: false,
			},
			createActions(),
		)

		expect(
			items.find((item) => item.type !== "separator" && item.id === "remove-bookmark"),
		).toEqual(expect.objectContaining({ text: "Remove Bookmark" }))
	})

	it("omits Markdown-only actions for PDF files", () => {
		const items = buildNoteMenuItems(
			{
				path: "/vault/source.pdf",
				bookmarked: false,
				syncIgnored: false,
				showVersionHistory: true,
				canToggleSync: true,
				supportsNoteActions: false,
			},
			createActions(),
		)

		expect(items.map((item) => (item.type === "separator" ? "separator" : item.id))).toEqual([
			"open-new-tab",
			"open-right-split",
			"separator",
			"copy-path",
			"reveal",
			"separator",
			"exclude-from-sync",
			"separator",
			"rename",
			"separator",
			"delete",
		])
		expect(items.some((item) => item.type !== "separator" && item.id === "make-copy")).toBe(false)
		expect(items.some((item) => item.type !== "separator" && item.id === "export-note")).toBe(false)
		expect(items.some((item) => item.type !== "separator" && item.id === "add-bookmark")).toBe(
			false,
		)
		expect(items.some((item) => item.type !== "separator" && item.id === "version-history")).toBe(
			false,
		)
	})
})
