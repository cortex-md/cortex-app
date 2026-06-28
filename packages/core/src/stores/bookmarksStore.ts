import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export const BOOKMARKS_FILE = ".cortex/bookmarks.json"

const BOOKMARKS_DOCUMENT_VERSION = 1

export interface BookmarkEntry {
	path: string
	addedAt: number
}

export interface BookmarkToggleResult {
	bookmarked: boolean
	bookmark: BookmarkEntry | null
}

interface BookmarksDocument {
	version: 1
	items: BookmarkEntry[]
}

interface BookmarkSnapshot {
	bookmarks: BookmarkEntry[]
	bookmarkedPaths: Record<string, true>
	error: string | null
}

type BookmarkPathMode = "bookmark" | "reference"

function normalizeSlashes(path: string): string {
	return path.replaceAll("\\", "/").replace(/\/+/g, "/")
}

function trimPathBoundary(path: string): string {
	return path
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
}

function isAbsolutePath(path: string): boolean {
	return path.startsWith("/") || /^[A-Za-z]:\//.test(path)
}

function normalizeVaultRoot(vaultPath: string): string {
	return normalizeSlashes(vaultPath).replace(/\/+$/, "")
}

export function normalizeBookmarkPath(
	vaultPath: string,
	filePath: string,
	mode: BookmarkPathMode = "bookmark",
): string | null {
	const vaultRoot = normalizeVaultRoot(vaultPath)
	const normalizedPath = normalizeSlashes(filePath.trim())
	const relativePath =
		normalizedPath === vaultRoot
			? ""
			: normalizedPath.startsWith(`${vaultRoot}/`)
				? normalizedPath.slice(vaultRoot.length + 1)
				: isAbsolutePath(normalizedPath)
					? ""
					: trimPathBoundary(normalizedPath)

	if (!relativePath) return null
	const normalizedRelativePath = trimPathBoundary(normalizeSlashes(relativePath))
	if (!normalizedRelativePath || normalizedRelativePath.startsWith(".cortex/")) return null
	const segments = normalizedRelativePath.split("/")
	if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null
	if (mode === "bookmark" && !normalizedRelativePath.toLocaleLowerCase().endsWith(".md")) {
		return null
	}
	return normalizedRelativePath
}

export function resolveBookmarkPath(vaultPath: string, bookmarkPath: string): string {
	return `${normalizeVaultRoot(vaultPath)}/${normalizeBookmarkPath(vaultPath, bookmarkPath) ?? trimPathBoundary(normalizeSlashes(bookmarkPath))}`
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath
	if (!path.startsWith(`${oldPath}/`)) return null
	return `${newPath}${path.slice(oldPath.length)}`
}

export function createBookmarkedPaths(bookmarks: BookmarkEntry[]): Record<string, true> {
	return Object.fromEntries(bookmarks.map((bookmark) => [bookmark.path, true] as const))
}

function createSnapshot(bookmarks: BookmarkEntry[], error: string | null = null): BookmarkSnapshot {
	return {
		bookmarks,
		bookmarkedPaths: createBookmarkedPaths(bookmarks),
		error,
	}
}

function createBookmarksDocument(bookmarks: BookmarkEntry[]): BookmarksDocument {
	return {
		version: BOOKMARKS_DOCUMENT_VERSION,
		items: bookmarks,
	}
}

export function normalizeBookmarksDocument(
	vaultPath: string,
	value: unknown,
	now = Date.now(),
): BookmarkEntry[] {
	const rawItems = Array.isArray(value)
		? value.map((path, index) => ({ path, addedAt: now + index }))
		: typeof value === "object" &&
				value !== null &&
				Array.isArray((value as { items?: unknown }).items)
			? (value as { items: unknown[] }).items
			: []
	const seen = new Set<string>()
	const bookmarks: BookmarkEntry[] = []

	for (const item of rawItems) {
		const pathValue =
			typeof item === "string"
				? item
				: typeof item === "object" && item !== null
					? (item as { path?: unknown }).path
					: null
		if (typeof pathValue !== "string") continue
		const path = normalizeBookmarkPath(vaultPath, pathValue)
		if (!path || seen.has(path)) continue
		seen.add(path)
		const addedAt =
			typeof item === "object" &&
			item !== null &&
			Number.isFinite((item as { addedAt?: unknown }).addedAt)
				? Number((item as { addedAt: number }).addedAt)
				: now + bookmarks.length
		bookmarks.push({ path, addedAt })
	}

	return bookmarks
}

export interface BookmarksState {
	bookmarks: BookmarkEntry[]
	bookmarkedPaths: Record<string, true>
	error: string | null

	loadBookmarks: (vaultPath: string) => Promise<void>
	addBookmark: (vaultPath: string, filePath: string) => Promise<BookmarkEntry | null>
	removeBookmark: (vaultPath: string, filePath: string) => Promise<void>
	toggleBookmark: (
		vaultPath: string,
		filePath: string,
		force?: boolean,
	) => Promise<BookmarkToggleResult>
	renameBookmarkPath: (vaultPath: string, oldPath: string, newPath: string) => Promise<void>
	removeBookmarksUnderPath: (vaultPath: string, filePath: string) => Promise<void>
	isBookmarked: (vaultPath: string, filePath: string) => boolean
	reset: () => void
}

async function persistBookmarks(vaultPath: string, bookmarks: BookmarkEntry[]) {
	const platform = getPlatform()
	await platform.fs.writeFile(
		`${vaultPath}/${BOOKMARKS_FILE}`,
		JSON.stringify(createBookmarksDocument(bookmarks), null, "\t"),
	)
}

function applySnapshot(
	set: (partial: BookmarkSnapshot) => void,
	bookmarks: BookmarkEntry[],
	error: string | null = null,
) {
	set(createSnapshot(bookmarks, error))
}

async function persistWithRollback(
	set: (partial: BookmarkSnapshot) => void,
	vaultPath: string,
	previousBookmarks: BookmarkEntry[],
	nextBookmarks: BookmarkEntry[],
) {
	applySnapshot(set, nextBookmarks)
	try {
		await persistBookmarks(vaultPath, nextBookmarks)
	} catch (error) {
		applySnapshot(set, previousBookmarks, error instanceof Error ? error.message : String(error))
		throw error
	}
}

export const useBookmarksStore = create<BookmarksState>()(
	devtools(
		immer((set, get) => ({
			bookmarks: [],
			bookmarkedPaths: {},
			error: null,

			loadBookmarks: async (vaultPath) => {
				const platform = getPlatform()
				try {
					const raw = await platform.fs.readFile(`${vaultPath}/${BOOKMARKS_FILE}`)
					const bookmarks = normalizeBookmarksDocument(vaultPath, JSON.parse(raw))
					applySnapshot(set, bookmarks)
				} catch (_e) {
					applySnapshot(set, [])
				}
			},

			addBookmark: async (vaultPath, filePath) => {
				const path = normalizeBookmarkPath(vaultPath, filePath)
				if (!path) return null
				const { bookmarks, bookmarkedPaths } = get()
				if (bookmarkedPaths[path])
					return bookmarks.find((bookmark) => bookmark.path === path) ?? null
				const bookmark = { path, addedAt: Date.now() }
				await persistWithRollback(set, vaultPath, bookmarks, [...bookmarks, bookmark])
				return bookmark
			},

			removeBookmark: async (vaultPath, filePath) => {
				const path = normalizeBookmarkPath(vaultPath, filePath)
				if (!path) return
				const { bookmarks, bookmarkedPaths } = get()
				if (!bookmarkedPaths[path]) return
				const updated = bookmarks.filter((bookmark) => bookmark.path !== path)
				await persistWithRollback(set, vaultPath, bookmarks, updated)
			},

			toggleBookmark: async (vaultPath, filePath, force) => {
				const path = normalizeBookmarkPath(vaultPath, filePath)
				if (!path) return { bookmarked: false, bookmark: null }
				const bookmarked = get().bookmarkedPaths[path] === true
				if (force === true || (!bookmarked && force !== false)) {
					const bookmark = await get().addBookmark(vaultPath, path)
					return { bookmarked: bookmark !== null, bookmark }
				}
				if (bookmarked) {
					await get().removeBookmark(vaultPath, path)
				}
				return { bookmarked: false, bookmark: null }
			},

			renameBookmarkPath: async (vaultPath, oldPath, newPath) => {
				const oldRelativePath = normalizeBookmarkPath(vaultPath, oldPath, "reference")
				const newRelativePath = normalizeBookmarkPath(vaultPath, newPath, "reference")
				if (!oldRelativePath || !newRelativePath) return
				const { bookmarks } = get()
				const seen = new Set<string>()
				const updated = bookmarks.flatMap((bookmark) => {
					const nextPath = replacePathPrefix(bookmark.path, oldRelativePath, newRelativePath)
					const normalizedPath = nextPath
						? normalizeBookmarkPath(vaultPath, nextPath)
						: bookmark.path
					if (!normalizedPath || seen.has(normalizedPath)) return []
					seen.add(normalizedPath)
					return [{ ...bookmark, path: normalizedPath }]
				})
				if (
					updated.length === bookmarks.length &&
					updated.every((bookmark, index) => bookmark.path === bookmarks[index].path)
				) {
					return
				}
				await persistWithRollback(set, vaultPath, bookmarks, updated)
			},

			removeBookmarksUnderPath: async (vaultPath, filePath) => {
				const relativePath = normalizeBookmarkPath(vaultPath, filePath, "reference")
				if (!relativePath) return
				const { bookmarks } = get()
				const updated = bookmarks.filter(
					(bookmark) =>
						bookmark.path !== relativePath && !bookmark.path.startsWith(`${relativePath}/`),
				)
				if (updated.length === bookmarks.length) return
				await persistWithRollback(set, vaultPath, bookmarks, updated)
			},

			isBookmarked: (vaultPath, filePath) => {
				const path = normalizeBookmarkPath(vaultPath, filePath)
				return path ? get().bookmarkedPaths[path] === true : false
			},

			reset: () => {
				applySnapshot(set, [])
			},
		})),
		{ name: "bookmarksStore" },
	),
)
