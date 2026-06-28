import { getPlatform } from "@cortex/platform"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../noteCache"
import { parseFrontmatter } from "../utils/frontmatter"
import { useTagsStore } from "./tagsStore"

function resetTagsStore() {
	useTagsStore.getState().reset()
	useTagsStore.setState({
		tagIndex: {},
		tagColors: {},
		fileTags: {},
		activeTagFilter: null,
	})
}

beforeEach(() => {
	noteCache.clear()
	resetTagsStore()
	vi.clearAllMocks()
})

afterEach(() => {
	noteCache.clear()
	resetTagsStore()
})

describe("tags store", () => {
	it("bounds concurrent markdown reads while building the tag index", async () => {
		let activeReads = 0
		let maxActiveReads = 0
		const readFile = vi.fn(async (path: string) => {
			activeReads++
			maxActiveReads = Math.max(maxActiveReads, activeReads)
			await Promise.resolve()
			activeReads--
			return `---\ntags: [tag-${path.split("-").pop()?.replace(".md", "")}]\n---\nBody`
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
			},
		} as never)
		const filePaths = Array.from({ length: 12 }, (_, index) => `/vault/note-${index}.md`)

		await useTagsStore.getState().buildIndex("/vault", filePaths)

		expect(maxActiveReads).toBeLessThanOrEqual(4)
		expect(Object.keys(useTagsStore.getState().fileTags)).toHaveLength(12)
	})

	it("reuses unchanged tags from the persisted index", async () => {
		const persistedIndex = JSON.stringify({
			version: 1,
			files: {
				"/vault/note.md": { mtime: 10, size: 20, tags: ["cached"] },
			},
		})
		const readFile = vi.fn(async (path: string) => {
			if (path.endsWith(".cortex/tags-index.json")) return persistedIndex
			throw new Error(`Unexpected note read: ${path}`)
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		await useTagsStore.getState().buildIndexFromFiles("/vault", [
			{
				path: "/vault/note.md",
				name: "note.md",
				isDir: false,
				mtime: 10,
				size: 20,
			},
		])

		expect(readFile).toHaveBeenCalledTimes(1)
		expect(useTagsStore.getState().fileTags["/vault/note.md"]).toEqual(["cached"])
		expect(useTagsStore.getState().tagIndex.cached).toEqual(["/vault/note.md"])
	})

	it("replaces YAML tags for a file and refreshes the local index", async () => {
		const filePath = "/vault/note.md"
		const files = new Map([[filePath, "---\ntags: [old]\n---\nBody"]])
		const readFile = vi.fn(async (path: string) => files.get(path) ?? "")
		const writeFile = vi.fn(async (path: string, content: string) => {
			files.set(path, content)
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile,
			},
		} as never)

		await useTagsStore.getState().setTagsForFile(filePath, ["AWS", "aws", "certificado"])

		expect(parseFrontmatter(files.get(filePath) ?? "").frontmatter?.tags).toEqual([
			"AWS",
			"certificado",
		])
		expect(useTagsStore.getState().fileTags[filePath]).toEqual(["aws", "certificado"])

		await useTagsStore.getState().setTagsForFile(filePath, [])

		expect(files.get(filePath)).not.toContain("tags:")
		expect(useTagsStore.getState().fileTags[filePath]).toEqual([])
		expect(writeFile).toHaveBeenCalledTimes(2)
	})

	it("does not publish stale tag indexing after cancellation", async () => {
		let resolveNoteRead: (content: string) => void = () => {}
		let markNoteReadStarted: () => void = () => {}
		const noteReadStarted = new Promise<void>((resolve) => {
			markNoteReadStarted = resolve
		})
		const readFile = vi.fn((path: string) => {
			if (path.endsWith(".cortex/tags-index.json")) return Promise.reject(new Error("No index"))
			markNoteReadStarted()
			return new Promise<string>((resolve) => {
				resolveNoteRead = resolve
			})
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		const indexing = useTagsStore.getState().buildIndexFromFiles("/vault", [
			{
				path: "/vault/note.md",
				name: "note.md",
				isDir: false,
				mtime: 10,
				size: 20,
			},
		])
		await noteReadStarted
		useTagsStore.getState().cancelIndexing()
		resolveNoteRead("---\ntags: [stale]\n---\nBody")
		await indexing

		expect(useTagsStore.getState().fileTags).toEqual({})
		expect(useTagsStore.getState().tagIndex).toEqual({})
	})
})
