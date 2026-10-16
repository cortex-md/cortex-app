import { type FileEntry, getPlatform } from "@cortex/platform"
import {
	type FileFingerprint,
	getFileEntryFingerprint,
	getVaultFilePath,
	hasSameFingerprint,
	isMarkdownPath,
	isPathOrDescendant,
	mapWithConcurrency,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { mutateNote } from "../notes/mutateNote"
import { createDebouncedWriter } from "../utils/createDebouncedWriter"
import {
	addTagToFrontmatter,
	extractAllTags,
	removeTagFromFrontmatter,
	renameTagInContent,
	setTagsInFrontmatter,
} from "../utils/frontmatter"
import { readTextFilesInBatches } from "../utils/readTextFilesInBatches"
import { isTagOrDescendant } from "../utils/tagHierarchy"
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

const TAG_INDEX_VERSION = 1
const TAG_INDEX_SERIALIZE_DELAY_MS = 5000
const TAG_INDEX_READ_CONCURRENCY = 4

interface PersistedTagFile extends FileFingerprint {
	tags: string[]
}

interface PersistedTagIndex {
	version: typeof TAG_INDEX_VERSION
	files: Record<string, PersistedTagFile>
}

const indexWriter = createDebouncedWriter(TAG_INDEX_SERIALIZE_DELAY_MS)
let tagIndexGeneration = 0
let indexedVaultPath: string | null = null
let indexedTagFiles = new Map<string, PersistedTagFile>()
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
	try {
		const raw = await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.tagColors))
		const parsed = JSON.parse(raw)
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, string>
		}
	} catch {}
	return {}
}

async function saveTagColorsToDisk(
	vaultPath: string,
	colors: Record<string, string>,
): Promise<void> {
	try {
		await getPlatform().fs.writeFile(
			getVaultFilePath(vaultPath, VAULT_FILES.tagColors),
			JSON.stringify(colors, null, "\t"),
		)
	} catch {}
}

function isPersistedTagIndex(value: unknown): value is PersistedTagIndex {
	if (!value || typeof value !== "object") return false
	const candidate = value as Partial<PersistedTagIndex>
	return (
		candidate.version === TAG_INDEX_VERSION &&
		Boolean(candidate.files) &&
		typeof candidate.files === "object" &&
		!Array.isArray(candidate.files)
	)
}

async function loadPersistedTagIndex(vaultPath: string): Promise<Map<string, PersistedTagFile>> {
	try {
		const raw = await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.tagIndex))
		const parsed = JSON.parse(raw) as unknown
		if (!isPersistedTagIndex(parsed)) return new Map()
		const files = new Map<string, PersistedTagFile>()
		for (const [filePath, entry] of Object.entries(parsed.files)) {
			if (
				typeof entry?.mtime === "number" &&
				typeof entry.size === "number" &&
				Array.isArray(entry.tags)
			) {
				files.set(filePath, {
					mtime: entry.mtime,
					size: entry.size,
					tags: entry.tags.filter((tag): tag is string => typeof tag === "string"),
				})
			}
		}
		return files
	} catch {
		return new Map()
	}
}

function scheduleTagIndexSerialize(vaultPath: string): void {
	indexWriter.schedule(() => {
		if (indexedVaultPath !== vaultPath) return
		const persisted: PersistedTagIndex = {
			version: TAG_INDEX_VERSION,
			files: Object.fromEntries(indexedTagFiles),
		}
		void getPlatform()
			.fs.writeFile(getVaultFilePath(vaultPath, VAULT_FILES.tagIndex), JSON.stringify(persisted))
			.catch(() => {})
	})
}

function buildTagIndex(files: ReadonlyMap<string, PersistedTagFile>): {
	tagIndex: Record<string, string[]>
	fileTags: Record<string, string[]>
} {
	const tagIndex: Record<string, string[]> = {}
	const fileTags: Record<string, string[]> = {}
	for (const [filePath, file] of files) {
		fileTags[filePath] = file.tags
		for (const tag of file.tags) {
			if (!tagIndex[tag]) tagIndex[tag] = []
			tagIndex[tag].push(filePath)
		}
	}
	return { tagIndex, fileTags }
}

function withoutFileTags(
	tagIndex: Record<string, string[]>,
	filePath: string,
	tags: readonly string[],
): Record<string, string[]> {
	const nextIndex = { ...tagIndex }
	for (const tag of tags) {
		const paths = nextIndex[tag]?.filter((path) => path !== filePath)
		if (paths && paths.length > 0) nextIndex[tag] = paths
		else delete nextIndex[tag]
	}
	return nextIndex
}

export const useTagsStore = create<TagsState>()(
	devtools(
		(set, get) => ({
			tagIndex: {},
			tagColors: {},
			fileTags: {},
			activeTagFilter: null,

			buildIndexFromFiles: async (vaultPath, files) => {
				const generation = ++tagIndexGeneration
				const platform = getPlatform()
				const cachedFiles =
					indexedVaultPath === vaultPath ? indexedTagFiles : await loadPersistedTagIndex(vaultPath)
				const nextFiles = new Map<string, PersistedTagFile>()
				const changedFiles: FileEntry[] = []
				for (const file of files) {
					if (file.isDir || !isMarkdownPath(file.path)) continue
					const cached = cachedFiles.get(file.path)
					if (cached && hasSameFingerprint(cached, getFileEntryFingerprint(file))) {
						nextFiles.set(file.path, cached)
					} else {
						changedFiles.push(file)
					}
				}
				const reads = await readTextFilesInBatches(changedFiles.map((file) => file.path))
				const indexedFiles = changedFiles.map((file, index) => {
					const read = reads[index]
					return read ? { file, tags: extractAllTags(read.content) } : null
				})
				if (generation !== tagIndexGeneration) return
				for (const indexedFile of indexedFiles) {
					if (!indexedFile) continue
					nextFiles.set(indexedFile.file.path, {
						...getFileEntryFingerprint(indexedFile.file),
						tags: indexedFile.tags,
					})
				}

				indexedVaultPath = vaultPath
				indexedTagFiles = nextFiles
				set(buildTagIndex(nextFiles))
				if (changedFiles.length > 0 || cachedFiles.size !== nextFiles.size) {
					scheduleTagIndexSerialize(vaultPath)
				}
			},

			updateFileInIndex: (filePath, rawContent, fingerprint) => {
				let updatedTags: string[]
				try {
					updatedTags = extractAllTags(rawContent)
				} catch {
					return
				}
				const { fileTags, tagIndex } = get()
				const nextIndex = withoutFileTags(tagIndex, filePath, fileTags[filePath] ?? [])
				for (const tag of updatedTags) {
					nextIndex[tag] = [...(nextIndex[tag] ?? []), filePath]
				}
				set({ tagIndex: nextIndex, fileTags: { ...fileTags, [filePath]: updatedTags } })

				if (!indexedVaultPath) return
				const previous = indexedTagFiles.get(filePath)
				indexedTagFiles.set(filePath, {
					...(fingerprint ?? { mtime: previous?.mtime ?? 0, size: previous?.size ?? 0 }),
					tags: updatedTags,
				})
				scheduleTagIndexSerialize(indexedVaultPath)
			},

			removeFileFromIndex: (filePath) => {
				const { fileTags, tagIndex } = get()
				const removedPaths = Object.keys(fileTags).filter((path) =>
					isPathOrDescendant(path, filePath),
				)
				if (removedPaths.length === 0) return
				let nextIndex = tagIndex
				const nextFileTags = { ...fileTags }
				for (const path of removedPaths) {
					nextIndex = withoutFileTags(nextIndex, path, fileTags[path] ?? [])
					delete nextFileTags[path]
					indexedTagFiles.delete(path)
				}
				set({ tagIndex: nextIndex, fileTags: nextFileTags })
				if (indexedVaultPath) scheduleTagIndexSerialize(indexedVaultPath)
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
				await saveTagColorsToDisk(vaultPath, newColors)
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
				await mapWithConcurrency([...filePaths], TAG_INDEX_READ_CONCURRENCY, async (filePath) => {
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
				tagIndexGeneration++
			},

			reset: () => {
				tagIndexGeneration++
				indexWriter.cancel()
				indexedVaultPath = null
				indexedTagFiles = new Map()
				set({ tagIndex: {}, fileTags: {}, activeTagFilter: null })
			},
		}),
		{ name: "tagsStore" },
	),
)
