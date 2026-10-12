import {
	createDefaultSyncConfig,
	useBookmarksStore,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildFileMenuItems } from "../../../features/file-explorer/fileMenu"

interface NoteMenuState {
	path: string
	bookmarked: boolean
	showVersionHistory: boolean
	hasVault: boolean
}

function buildNoteMenuItems({ path, bookmarked, showVersionHistory, hasVault }: NoteMenuState) {
	useVaultStore.setState({
		vault: hasVault ? { uuid: "vault", path: "/vault", name: "Vault", fileCount: 1 } : null,
	})
	useRemoteVaultStore.setState({
		syncConfig: {
			...createDefaultSyncConfig(),
			enabled: showVersionHistory,
			remoteVaultId: showVersionHistory ? "remote" : null,
		},
	})
	vi.spyOn(useBookmarksStore.getState(), "isBookmarked").mockReturnValue(bookmarked)
	return buildFileMenuItems({ filePath: path, isDirectory: false })
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("note menu actions", () => {
	it("keeps the shared action order and copy path submenu", () => {
		const items = buildNoteMenuItems({
			path: "/vault/note.md",
			bookmarked: false,
			showVersionHistory: true,
			hasVault: true,
		})

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
			"share-note",
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
		const items = buildNoteMenuItems({
			path: "/vault/note.md",
			bookmarked: false,
			showVersionHistory: false,
			hasVault: false,
		})

		expect(items.some((item) => item.type !== "separator" && item.id === "version-history")).toBe(
			false,
		)
		expect(items.find((item) => item.type !== "separator" && item.id === "delete")).toEqual(
			expect.objectContaining({ destructive: true }),
		)
	})

	it("uses the remove bookmark action when the note is already bookmarked", () => {
		const items = buildNoteMenuItems({
			path: "/vault/note.md",
			bookmarked: true,
			showVersionHistory: false,
			hasVault: true,
		})

		expect(
			items.find((item) => item.type !== "separator" && item.id === "remove-bookmark"),
		).toEqual(expect.objectContaining({ text: "Remove Bookmark" }))
	})

	it("omits Markdown-only actions for PDF files", () => {
		const items = buildNoteMenuItems({
			path: "/vault/source.pdf",
			bookmarked: false,
			showVersionHistory: true,
			hasVault: true,
		})

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
