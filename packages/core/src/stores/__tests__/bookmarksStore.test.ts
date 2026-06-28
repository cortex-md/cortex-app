import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	type BookmarkEntry,
	createBookmarkedPaths,
	useBookmarksStore,
} from "../../stores/bookmarksStore"

function setBookmarks(bookmarks: BookmarkEntry[]) {
	useBookmarksStore.setState({
		bookmarks,
		bookmarkedPaths: createBookmarkedPaths(bookmarks),
		error: null,
	})
}

function mockPlatform({
	readFile = vi.fn().mockRejectedValue(new Error("missing")),
	writeFile = vi.fn().mockResolvedValue(undefined),
} = {}) {
	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFile,
			writeFile,
		},
	} as never)

	return { readFile, writeFile }
}

function getPersistedBookmarks(writeFile: ReturnType<typeof vi.fn>) {
	return JSON.parse(writeFile.mock.calls.at(-1)?.[1] ?? "{}")
}

beforeEach(() => {
	vi.useRealTimers()
	useBookmarksStore.getState().reset()
	vi.clearAllMocks()
})

describe("bookmarksStore", () => {
	it("loads schema v1 bookmarks with deduped vault-relative Markdown paths", async () => {
		mockPlatform({
			readFile: vi.fn().mockResolvedValue(
				JSON.stringify({
					version: 1,
					items: [
						{ path: "Projects/Plan.md", addedAt: 10 },
						{ path: "/vault/Projects/Plan.md", addedAt: 11 },
						{ path: "Projects/Notes.txt", addedAt: 12 },
						{ path: ".cortex/private.md", addedAt: 13 },
					],
				}),
			),
		})

		await useBookmarksStore.getState().loadBookmarks("/vault")

		expect(useBookmarksStore.getState().bookmarks).toEqual([
			{ path: "Projects/Plan.md", addedAt: 10 },
		])
		expect(useBookmarksStore.getState().bookmarkedPaths).toEqual({
			"Projects/Plan.md": true,
		})
	})

	it("migrates legacy string arrays on load", async () => {
		vi.setSystemTime(new Date("2026-06-26T12:00:00Z"))
		mockPlatform({
			readFile: vi
				.fn()
				.mockResolvedValue(JSON.stringify(["/vault/Projects/Plan.md", "Inbox.md", "Inbox.md"])),
		})

		await useBookmarksStore.getState().loadBookmarks("/vault")

		expect(useBookmarksStore.getState().bookmarks).toEqual([
			{ path: "Projects/Plan.md", addedAt: Date.now() },
			{ path: "Inbox.md", addedAt: Date.now() + 1 },
		])
	})

	it("adds, dedupes, toggles, and persists bookmarks in schema v1", async () => {
		vi.setSystemTime(new Date("2026-06-26T12:00:00Z"))
		const { writeFile } = mockPlatform()

		const added = await useBookmarksStore
			.getState()
			.addBookmark("/vault", "/vault/Projects/Plan.md")
		await useBookmarksStore.getState().addBookmark("/vault", "Projects/Plan.md")

		expect(added).toEqual({ path: "Projects/Plan.md", addedAt: Date.now() })
		expect(useBookmarksStore.getState().isBookmarked("/vault", "Projects/Plan.md")).toBe(true)
		expect(writeFile).toHaveBeenCalledTimes(1)
		expect(getPersistedBookmarks(writeFile)).toEqual({
			version: 1,
			items: [{ path: "Projects/Plan.md", addedAt: Date.now() }],
		})

		await useBookmarksStore.getState().toggleBookmark("/vault", "Projects/Plan.md", false)

		expect(useBookmarksStore.getState().bookmarks).toEqual([])
		expect(getPersistedBookmarks(writeFile)).toEqual({ version: 1, items: [] })
	})

	it("renames folder descendants and removes deleted paths", async () => {
		mockPlatform()
		setBookmarks([
			{ path: "Folder/Current.md", addedAt: 1 },
			{ path: "Folder/Nested/Other.md", addedAt: 2 },
			{ path: "Keep.md", addedAt: 3 },
		])

		await useBookmarksStore
			.getState()
			.renameBookmarkPath("/vault", "/vault/Folder", "/vault/Archive/Folder")
		await useBookmarksStore.getState().removeBookmarksUnderPath("/vault", "Archive/Folder/Nested")

		expect(useBookmarksStore.getState().bookmarks).toEqual([
			{ path: "Archive/Folder/Current.md", addedAt: 1 },
			{ path: "Keep.md", addedAt: 3 },
		])
	})

	it("rolls back optimistic updates when persistence fails", async () => {
		mockPlatform({
			writeFile: vi.fn().mockRejectedValue(new Error("disk full")),
		})
		setBookmarks([{ path: "Keep.md", addedAt: 1 }])

		await expect(useBookmarksStore.getState().addBookmark("/vault", "New.md")).rejects.toThrow(
			"disk full",
		)

		expect(useBookmarksStore.getState().bookmarks).toEqual([{ path: "Keep.md", addedAt: 1 }])
		expect(useBookmarksStore.getState().error).toBe("disk full")
	})
})
