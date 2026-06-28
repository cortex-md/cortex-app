import { type FileEntry, getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { noteCache } from "../noteCache"
import {
	addTagToFrontmatter,
	extractAllTags,
	removeTagFromFrontmatter,
	setTagsInFrontmatter,
} from "../utils/frontmatter"

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

	buildIndex: (vaultPath: string, filePaths: string[]) => Promise<void>
	buildIndexFromFiles: (vaultPath: string, files: FileEntry[]) => Promise<void>
	updateFileInIndex: (filePath: string, rawContent: string) => void
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
	cancelIndexing: () => void
	reset: () => void
}

const TAG_COLORS_FILE = ".cortex/tags.json"
const TAG_INDEX_FILE = ".cortex/tags-index.json"
const TAG_INDEX_VERSION = 1
const TAG_INDEX_READ_CONCURRENCY = 4

interface TagFileFingerprint {
	mtime: number
	size: number
}

interface PersistedTagFile extends TagFileFingerprint {
	tags: string[]
}

interface PersistedTagIndex {
	version: typeof TAG_INDEX_VERSION
	files: Record<string, PersistedTagFile>
}

let tagIndexSerializeTimer: ReturnType<typeof setTimeout> | null = null
let tagIndexGeneration = 0

async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length)
	let nextIndex = 0
	const workerCount = Math.min(concurrency, items.length)
	const runNext = async (): Promise<void> => {
		const index = nextIndex
		nextIndex++
		if (index >= items.length) return
		results[index] = await worker(items[index])
		return runNext()
	}
	await Promise.all(Array.from({ length: workerCount }, () => runNext()))
	return results
}

async function loadTagColorsFromDisk(vaultPath: string): Promise<Record<string, string>> {
	try {
		const platform = getPlatform()
		const raw = await platform.fs.readFile(`${vaultPath}/${TAG_COLORS_FILE}`)
		const parsed = JSON.parse(raw)
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, string>
		}
	} catch (_e) {}
	return {}
}

async function saveTagColorsToDisk(
	vaultPath: string,
	colors: Record<string, string>,
): Promise<void> {
	try {
		const platform = getPlatform()
		await platform.fs.writeFile(
			`${vaultPath}/${TAG_COLORS_FILE}`,
			JSON.stringify(colors, null, "\t"),
		)
	} catch (_e) {}
}

function getFileFingerprint(file: FileEntry): TagFileFingerprint {
	return {
		mtime: file.mtime ?? 0,
		size: file.size ?? 0,
	}
}

function hasSameFingerprint(
	left: TagFileFingerprint | undefined,
	right: TagFileFingerprint,
): boolean {
	return Boolean(left && left.mtime === right.mtime && left.size === right.size)
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
		const raw = await getPlatform().fs.readFile(`${vaultPath}/${TAG_INDEX_FILE}`)
		const parsed = JSON.parse(raw) as unknown
		if (!isPersistedTagIndex(parsed)) return new Map()
		const files = new Map<string, PersistedTagFile>()
		for (const [filePath, entry] of Object.entries(parsed.files)) {
			if (
				entry &&
				typeof entry === "object" &&
				typeof entry.mtime === "number" &&
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
	} catch (_e) {
		return new Map()
	}
}

function addTagsForFile(
	tagIndex: Record<string, string[]>,
	fileTags: Record<string, string[]>,
	filePath: string,
	tags: string[],
): void {
	fileTags[filePath] = tags
	for (const tag of tags) {
		if (!tagIndex[tag]) tagIndex[tag] = []
		tagIndex[tag].push(filePath)
	}
}

function scheduleTagIndexSerialize(
	vaultPath: string,
	files: Record<string, PersistedTagFile>,
): void {
	if (tagIndexSerializeTimer) clearTimeout(tagIndexSerializeTimer)
	tagIndexSerializeTimer = setTimeout(async () => {
		try {
			const persisted: PersistedTagIndex = {
				version: TAG_INDEX_VERSION,
				files,
			}
			await getPlatform().fs.writeFile(`${vaultPath}/${TAG_INDEX_FILE}`, JSON.stringify(persisted))
		} catch (_e) {}
	}, 5000)
}

export const useTagsStore = create<TagsState>()(
	devtools(
		(set, get) => ({
			tagIndex: {},
			tagColors: {},
			fileTags: {},
			activeTagFilter: null,

			buildIndex: async (vaultPath, filePaths) => {
				await get().buildIndexFromFiles(
					vaultPath,
					filePaths.map((path) => ({
						path,
						name: path.split("/").pop() ?? path,
						isDir: false,
					})),
				)
			},

			buildIndexFromFiles: async (vaultPath, files) => {
				const generation = ++tagIndexGeneration
				const platform = getPlatform()
				const newTagIndex: Record<string, string[]> = {}
				const fileTags: Record<string, string[]> = {}
				const persistedFiles = await loadPersistedTagIndex(vaultPath)
				const nextPersistedFiles: Record<string, PersistedTagFile> = {}

				const mdFiles = files.filter((file) => !file.isDir && file.path.endsWith(".md"))
				const changedFiles: FileEntry[] = []
				for (const file of mdFiles) {
					const fingerprint = getFileFingerprint(file)
					const cached = persistedFiles.get(file.path)
					if (cached && hasSameFingerprint(cached, fingerprint)) {
						addTagsForFile(newTagIndex, fileTags, file.path, cached.tags)
						nextPersistedFiles[file.path] = cached
						continue
					}
					changedFiles.push(file)
				}
				const indexedFiles = await mapWithConcurrency(
					changedFiles,
					TAG_INDEX_READ_CONCURRENCY,
					async (file) => {
						try {
							const content = await platform.fs.readFile(file.path)
							return {
								filePath: file.path,
								fingerprint: getFileFingerprint(file),
								tags: extractAllTags(content),
							}
						} catch {
							return null
						}
					},
				)

				for (const indexedFile of indexedFiles) {
					if (!indexedFile) continue
					addTagsForFile(newTagIndex, fileTags, indexedFile.filePath, indexedFile.tags)
					nextPersistedFiles[indexedFile.filePath] = {
						...indexedFile.fingerprint,
						tags: indexedFile.tags,
					}
				}

				if (generation !== tagIndexGeneration) return
				set({ tagIndex: newTagIndex, fileTags })
				scheduleTagIndexSerialize(vaultPath, nextPersistedFiles)
			},

			updateFileInIndex: (filePath, rawContent) => {
				const previousTags = get().fileTags[filePath] ?? []
				const updatedTags = extractAllTags(rawContent)

				const { fileTags, tagIndex } = get()
				const newIndex = { ...tagIndex }

				for (const tag of previousTags) {
					if (newIndex[tag]) {
						newIndex[tag] = newIndex[tag].filter((p) => p !== filePath)
						if (newIndex[tag].length === 0) delete newIndex[tag]
					}
				}

				for (const tag of updatedTags) {
					const indexedPaths = new Set(newIndex[tag] ?? [])
					if (!indexedPaths.has(filePath)) indexedPaths.add(filePath)
					newIndex[tag] = Array.from(indexedPaths)
				}

				set({
					tagIndex: newIndex,
					fileTags: { ...fileTags, [filePath]: updatedTags },
				})
			},

			removeFileFromIndex: (filePath) => {
				const { fileTags, tagIndex } = get()
				const previousTags = fileTags[filePath] ?? []
				const nextFileTags = { ...fileTags }
				delete nextFileTags[filePath]

				const newIndex = { ...tagIndex }

				for (const tag of previousTags) {
					if (newIndex[tag]) {
						newIndex[tag] = newIndex[tag].filter((p) => p !== filePath)
						if (newIndex[tag].length === 0) delete newIndex[tag]
					}
				}

				set({ tagIndex: newIndex, fileTags: nextFileTags })
			},

			setActiveTagFilter: (tag) => {
				set({ activeTagFilter: tag })
			},

			getAllTags: () => {
				const { tagIndex, tagColors } = get()
				return Object.entries(tagIndex)
					.map(([tag, filePaths]) => ({
						tag,
						color: tagColors[tag] ?? null,
						filePaths,
					}))
					.sort((a, b) => b.filePaths.length - a.filePaths.length || a.tag.localeCompare(b.tag))
			},

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
				const entry = noteCache.getEntry(filePath)
				const platform = getPlatform()
				const content = entry ? entry.content : await platform.fs.readFile(filePath)
				const updated = addTagToFrontmatter(content, tag)
				if (updated === content) return

				if (entry) {
					noteCache.writeExternal(filePath, updated)
				} else {
					await platform.fs.writeFile(filePath, updated)
				}
				get().updateFileInIndex(filePath, updated)
			},

			removeTagFromFile: async (filePath, tag) => {
				const entry = noteCache.getEntry(filePath)
				const platform = getPlatform()
				const content = entry ? entry.content : await platform.fs.readFile(filePath)
				const updated = removeTagFromFrontmatter(content, tag)
				if (updated === content) return

				if (entry) {
					noteCache.writeExternal(filePath, updated)
				} else {
					await platform.fs.writeFile(filePath, updated)
				}
				get().updateFileInIndex(filePath, updated)
			},

			setTagsForFile: async (filePath, tags) => {
				const entry = noteCache.getEntry(filePath)
				const platform = getPlatform()
				const content = entry ? entry.content : await platform.fs.readFile(filePath)
				const updated = setTagsInFrontmatter(content, tags)
				if (updated === content) return

				if (entry) {
					noteCache.writeExternal(filePath, updated)
				} else {
					await platform.fs.writeFile(filePath, updated)
				}
				get().updateFileInIndex(filePath, updated)
			},

			cancelIndexing: () => {
				tagIndexGeneration++
			},

			reset: () => {
				tagIndexGeneration++
				if (tagIndexSerializeTimer) clearTimeout(tagIndexSerializeTimer)
				tagIndexSerializeTimer = null
				set({ tagIndex: {}, fileTags: {}, activeTagFilter: null })
			},
		}),
		{ name: "tagsStore" },
	),
)
