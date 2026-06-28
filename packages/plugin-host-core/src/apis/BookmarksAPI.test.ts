import type { BookmarkEntry, PluginCapability } from "@cortex.md/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pluginStore } from "../pluginStore"
import { createBookmarksAPI, setBookmarksFunctions } from "./BookmarksAPI"

const bookmarks: BookmarkEntry[] = [{ path: "Projects/Plan.md", addedAt: 1 }]
const list = vi.fn(() => bookmarks)
const add = vi.fn(async (path: string) => ({ path, addedAt: 2 }))
const remove = vi.fn().mockResolvedValue(undefined)
const toggle = vi.fn(async (path: string) => ({
	bookmarked: true,
	bookmark: { path, addedAt: 2 },
}))
const isBookmarked = vi.fn((path: string) => path === "Projects/Plan.md")
const subscribe = vi.fn((callback: (bookmarks: BookmarkEntry[]) => void) => {
	callback(bookmarks)
	return vi.fn()
})

function registerPlugin(capabilities: PluginCapability[] = []): void {
	pluginStore.getState().registerPlugin({
		id: "bookmark-plugin",
		name: "Bookmark Plugin",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Uses bookmarks",
		icon: "bookmark",
		main: "index.js",
		capabilities,
	})
}

beforeEach(() => {
	setBookmarksFunctions({ list, add, remove, toggle, isBookmarked, subscribe })
})

afterEach(() => {
	pluginStore.getState().reset()
	vi.clearAllMocks()
})

describe("BookmarksAPI", () => {
	it("requires bookmark capabilities", async () => {
		registerPlugin()
		const api = createBookmarksAPI("bookmark-plugin")

		expect(() => api.list()).toThrow("bookmarks:read capability")
		expect(() => api.isBookmarked("Projects/Plan.md")).toThrow("bookmarks:read capability")
		expect(() => api.onChange(vi.fn())).toThrow("bookmarks:read capability")
		await expect(api.add("Projects/Plan.md")).rejects.toThrow("bookmarks:write capability")
		await expect(api.remove("Projects/Plan.md")).rejects.toThrow("bookmarks:write capability")
		await expect(api.toggle("Projects/Plan.md")).rejects.toThrow("bookmarks:write capability")
	})

	it("forwards reads and writes with cloned bookmark entries", async () => {
		registerPlugin(["bookmarks:read", "bookmarks:write"])
		const api = createBookmarksAPI("bookmark-plugin")

		expect(api.list()).toEqual(bookmarks)
		expect(api.list()).not.toBe(bookmarks)
		await expect(api.add("Projects/New.md")).resolves.toEqual({
			path: "Projects/New.md",
			addedAt: 2,
		})
		await expect(api.toggle("Projects/New.md")).resolves.toEqual({
			bookmarked: true,
			bookmark: { path: "Projects/New.md", addedAt: 2 },
		})
		await api.remove("Projects/Plan.md")

		expect(isBookmarked("Projects/Plan.md")).toBe(true)
		expect(add).toHaveBeenCalledWith("Projects/New.md")
		expect(remove).toHaveBeenCalledWith("Projects/Plan.md")
	})

	it("rejects non-portable bookmark paths", async () => {
		registerPlugin(["bookmarks:read", "bookmarks:write"])
		const api = createBookmarksAPI("bookmark-plugin")

		await expect(api.add("/vault/Projects/Plan.md")).rejects.toThrow("inside the active vault")
		await expect(api.toggle("../Plan.md")).rejects.toThrow("inside the active vault")
		await expect(api.remove("Projects/Plan.txt")).rejects.toThrow("inside the active vault")
		expect(() => api.isBookmarked("C:/Vault/Plan.md")).toThrow("inside the active vault")
	})

	it("emits bookmark entry snapshots on change", () => {
		registerPlugin(["bookmarks:read"])
		const api = createBookmarksAPI("bookmark-plugin")
		const callback = vi.fn()

		api.onChange(callback)

		expect(callback).toHaveBeenCalledWith([{ path: "Projects/Plan.md", addedAt: 1 }])
		expect(callback.mock.calls[0][0]).not.toBe(bookmarks)
	})
})
