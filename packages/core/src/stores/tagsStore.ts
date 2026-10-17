import type { FileEntry } from "@cortex/platform"
import { type FileFingerprint, mapWithConcurrency } from "@cortex/platform/utils"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { noteMetadataIndex } from "../indexing/noteMetadataIndex"
import { mutateNote } from "../notes/mutateNote"
import {
	addTagToFrontmatter,
	removeTagFromFrontmatter,
	renameTagInContent,
	setTagsInFrontmatter,
} from "../utils/frontmatter"
import { isTagOrDescendant } from "../utils/tagHierarchy"
import { getLocalVaultState } from "../vault/vaultStateFiles"
import { assertVaultPathWritable, canWriteVaultPath } from "./accessStore"

export interface TagColor {
	tag: string
	color: string | null
}

export interface TagEntry {
	tag: string
	color: string | null
	filePaths: string[]
}

export interface TagsState {
	tagIndex: Record<string, string[]>
	tagColors: Record<string, string>
	fileTags: Record<string, string[]>
	activeTagFilter: string | null

	buildIndexFromFiles: (vaultPath: string, files: FileEntry[]) => Promise<void>
	updateFileInIndex: (filePath: string, rawContent: string, fingerprint?: FileFingerprint) => void
	removeFileFromIndex: (filePath: string) => void
	setActiveTagFilter: (tag: string | null) => void
	getAllTags: () => TagEntry[]
	getTagsForFile: (filePath: string) => string[]
	getFilesForTag: (tag: string) => string[]
	getTagColor: (tag: string) => string | null
	setTagColor: (vaultPath: string, tag: string, color: string | null) => Promise<void>
	loadTagColors: (vaultPath: string) => Promise<void>
	addTagToFile: (filePath: string, tag: string) => Promise<void>
	removeTagFromFile: (filePath: string, tag: string) => Promise<void>
	setTagsForFile: (filePath: string, tags: string[]) => Promise<void>
	renameTag: (vaultPath: string, oldTag: string, newTag: string) => Promise<number>
	cancelIndexing: () => void
	reset: () => void
}

const TAG_RENAME_CONCURRENCY = 4

let sortedTagsCache: {
	tagIndex: Record<string, string[]>
	tagColors: Record<string, string>
	entries: TagEntry[]
} | null = null

export function selectSortedTags(state: Pick<TagsState, "tagIndex" | "tagColors">): TagEntry[] {
	if (
		sortedTagsCache?.tagIndex === state.tagIndex &&
		sortedTagsCache.tagColors === state.tagColors
	) {
		return sortedTagsCache.entries
	}
	const entries = Object.entries(state.tagIndex)
		.map(([tag, filePaths]) => ({ tag, color: state.tagColors[tag] ?? null, filePaths }))
		.sort((a, b) => b.filePaths.length - a.filePaths.length || a.tag.localeCompare(b.tag))
	sortedTagsCache = { tagIndex: state.tagIndex, tagColors: state.tagColors, entries }
	return entries
}

async function loadTagColorsFromDisk(vaultPath: string): Promise<Record<string, string>> {
	return (await getLocalVaultState(vaultPath).read()).tagColors
}

function saveTagColorsToDisk(vaultPath: string, colors: Record<string, string>): void {
	void getLocalVaultState(vaultPath)
		.update((state) => ({ ...state, tagColors: colors }))
		.catch(() => undefined)
}

export const useTagsStore = create<TagsState>()(
	devtools(
		(set, get) => ({
			tagIndex: {},
			tagColors: {},
			fileTags: {},
			activeTagFilter: null,

			buildIndexFromFiles: (vaultPath, files) => noteMetadataIndex.build(vaultPath, files),

			updateFileInIndex: (filePath, rawContent, fingerprint) => {
				noteMetadataIndex.update(filePath, rawContent, fingerprint)
			},

			removeFileFromIndex: (filePath) => {
				noteMetadataIndex.remove(filePath)
			},

			setActiveTagFilter: (tag) => {
				set({ activeTagFilter: tag })
			},

			getAllTags: () => selectSortedTags(get()),

			getTagsForFile: (filePath) => {
				return get().fileTags[filePath] ?? []
			},

			getFilesForTag: (tag) => {
				const { tagIndex } = get()
				return tagIndex[tag] ?? []
			},

			getTagColor: (tag) => {
				return get().tagColors[tag] ?? null
			},

			setTagColor: async (vaultPath, tag, color) => {
				const { tagColors } = get()
				const newColors = { ...tagColors }
				if (color) {
					newColors[tag] = color
				} else {
					delete newColors[tag]
				}
				set({ tagColors: newColors })
				saveTagColorsToDisk(vaultPath, newColors)
			},

			loadTagColors: async (vaultPath) => {
				const colors = await loadTagColorsFromDisk(vaultPath)
				set({ tagColors: colors })
			},

			addTagToFile: async (filePath, tag) => {
				assertVaultPathWritable(filePath)
				const mutation = await mutateNote(filePath, (content) => addTagToFrontmatter(content, tag))
				if (mutation) get().updateFileInIndex(filePath, mutation.next)
			},

			removeTagFromFile: async (filePath, tag) => {
				assertVaultPathWritable(filePath)
				const mutation = await mutateNote(filePath, (content) =>
					removeTagFromFrontmatter(content, tag),
				)
				if (mutation) get().updateFileInIndex(filePath, mutation.next)
			},

			setTagsForFile: async (filePath, tags) => {
				assertVaultPathWritable(filePath)
				const mutation = await mutateNote(filePath, (content) =>
					setTagsInFrontmatter(content, tags),
				)
				if (mutation) get().updateFileInIndex(filePath, mutation.next)
			},

			renameTag: async (vaultPath, oldTag, newTag) => {
				const from = oldTag.trim().replace(/^#/, "").toLowerCase()
				const to = newTag.trim().replace(/^#/, "")
				if (!from || !to || from === to.toLowerCase()) return 0
				const { tagIndex, tagColors } = get()
				const filePaths = new Set<string>()
				for (const [tag, paths] of Object.entries(tagIndex)) {
					if (isTagOrDescendant(tag, from)) for (const path of paths) filePaths.add(path)
				}
				let renamed = 0
				await mapWithConcurrency([...filePaths], TAG_RENAME_CONCURRENCY, async (filePath) => {
					if (!canWriteVaultPath(filePath)) return
					const mutation = await mutateNote(filePath, (content) =>
						renameTagInContent(content, from, to),
					)
					if (!mutation) return
					get().updateFileInIndex(filePath, mutation.next)
					renamed++
				})
				for (const [tag, color] of Object.entries(tagColors)) {
					if (!isTagOrDescendant(tag, from)) continue
					await get().setTagColor(vaultPath, `${to.toLowerCase()}${tag.slice(from.length)}`, color)
					await get().setTagColor(vaultPath, tag, null)
				}
				return renamed
			},

			cancelIndexing: () => {
				noteMetadataIndex.cancel()
			},

			reset: () => {
				noteMetadataIndex.reset()
			},
		}),
		{ name: "tagsStore" },
	),
)
