import { bench } from "vitest"
import {
	createBookmarkedPaths,
	normalizeBookmarksDocument,
	resolveBookmarkPath,
	type BookmarkEntry,
} from "../../packages/core/src/stores/bookmarksStore"
import { getNotePathPresentation } from "../../packages/core/src/utils/fileName"

const vaultPath = "/vault"

function createBookmarkEntries(count: number): BookmarkEntry[] {
	return Array.from({ length: count }, (_, index) => ({
		path: `Folder ${Math.floor(index / 100)}/Note ${index}.md`,
		addedAt: index,
	}))
}

function filterBookmarks(bookmarks: BookmarkEntry[], query: string): number {
	const normalizedQuery = query.toLocaleLowerCase()
	let matched = 0
	for (const bookmark of bookmarks) {
		const filePath = resolveBookmarkPath(vaultPath, bookmark.path)
		const presentation = getNotePathPresentation(filePath, vaultPath)
		const searchable = `${presentation.title}\n${bookmark.path}`.toLocaleLowerCase()
		if (searchable.includes(normalizedQuery)) matched++
	}
	return matched
}

const tenThousandBookmarks = createBookmarkEntries(10_000)
const fiftyThousandBookmarks = createBookmarkEntries(50_000)
const legacyAbsolutePaths = tenThousandBookmarks.map((bookmark) => `${vaultPath}/${bookmark.path}`)
const lookupPaths = fiftyThousandBookmarks.map((bookmark) => bookmark.path)
const lookupIndex = createBookmarkedPaths(fiftyThousandBookmarks)

bench(
	"Bookmarks normalize 10k legacy absolute paths",
	() => {
		normalizeBookmarksDocument(vaultPath, legacyAbsolutePaths, 1)
	},
	{ iterations: 50 },
)

bench(
	"Bookmarks build 50k lookup index",
	() => {
		createBookmarkedPaths(fiftyThousandBookmarks)
	},
	{ iterations: 50 },
)

bench(
	"Bookmarks O(1) lookup 50k paths",
	() => {
		let hits = 0
		for (const path of lookupPaths) {
			if (lookupIndex[path]) hits++
		}
		return hits
	},
	{ iterations: 50 },
)

bench(
	"Bookmarks sidebar filter 10k rows",
	() => {
		filterBookmarks(tenThousandBookmarks, "note 999")
	},
	{ iterations: 20 },
)
