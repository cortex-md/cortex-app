import type { BookmarkEntry, BookmarkToggleResult, Disposable, PluginAPI } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

interface BookmarksFunctions {
	list: () => BookmarkEntry[]
	add: (path: string) => Promise<BookmarkEntry | null>
	remove: (path: string) => Promise<void>
	toggle: (path: string, force?: boolean) => Promise<BookmarkToggleResult>
	isBookmarked: (path: string) => boolean
	subscribe: (callback: (bookmarks: BookmarkEntry[]) => void) => () => void
}

let bookmarksFns: BookmarksFunctions | null = null

export function setBookmarksFunctions(fns: BookmarksFunctions): void {
	bookmarksFns = fns
}

function assertPluginBookmarkPath(path: string): void {
	const normalized = path.replaceAll("\\", "/").trim()
	if (
		!normalized ||
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		normalized.startsWith(".cortex/") ||
		!normalized.toLocaleLowerCase().endsWith(".md") ||
		normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error("Bookmarks only support Markdown files inside the active vault")
	}
}

function cloneBookmark(bookmark: BookmarkEntry): BookmarkEntry {
	return { path: bookmark.path, addedAt: bookmark.addedAt }
}

export function createBookmarksAPI(pluginId: string): PluginAPI["bookmarks"] {
	return {
		list(): BookmarkEntry[] {
			requirePluginCapability(pluginId, "bookmarks:read")
			return bookmarksFns?.list().map(cloneBookmark) ?? []
		},

		async add(path: string): Promise<BookmarkEntry | null> {
			requirePluginCapability(pluginId, "bookmarks:write")
			assertPluginBookmarkPath(path)
			const bookmark = await bookmarksFns?.add(path)
			return bookmark ? cloneBookmark(bookmark) : null
		},

		async remove(path: string): Promise<void> {
			requirePluginCapability(pluginId, "bookmarks:write")
			assertPluginBookmarkPath(path)
			await bookmarksFns?.remove(path)
		},

		async toggle(path: string, force?: boolean): Promise<BookmarkToggleResult> {
			requirePluginCapability(pluginId, "bookmarks:write")
			assertPluginBookmarkPath(path)
			const result = await bookmarksFns?.toggle(path, force)
			return {
				bookmarked: result?.bookmarked ?? false,
				bookmark: result?.bookmark ? cloneBookmark(result.bookmark) : null,
			}
		},

		isBookmarked(path: string): boolean {
			requirePluginCapability(pluginId, "bookmarks:read")
			assertPluginBookmarkPath(path)
			return bookmarksFns?.isBookmarked(path) ?? false
		},

		onChange(callback: (bookmarks: BookmarkEntry[]) => void): Disposable {
			requirePluginCapability(pluginId, "bookmarks:read")
			const unsubscribe = bookmarksFns?.subscribe((bookmarks) =>
				callback(bookmarks.map(cloneBookmark)),
			)
			return {
				dispose() {
					unsubscribe?.()
				},
			}
		},
	}
}
