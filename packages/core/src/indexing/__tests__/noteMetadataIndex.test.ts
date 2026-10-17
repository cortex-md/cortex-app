import { type FileEntry, getPlatform } from "@cortex/platform"
import { extractFrontmatterBody } from "@cortex/properties"
import { extractWikiLinks } from "@cortex/search"
import { parseTasks } from "@cortex/tasks"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useLinksStore } from "../../stores/linksStore"
import { useTagsStore } from "../../stores/tagsStore"
import { useTasksStore } from "../../stores/tasksStore"
import { extractAllTags } from "../../utils/frontmatter"
import {
	extractNoteMetadata,
	noteMetadataIndex,
	parsePersistedNotesIndex,
} from "../noteMetadataIndex"

const VAULT = "/vault"

const FIXTURES: Record<string, string> = {
	"/vault/plain.md": "Just text with #Inline and [[Target]] and a [[folder/Other|alias]].",
	"/vault/front.md":
		"---\ntags: [Project, area/work]\nstatus: active\naliases: [Front]\n---\n# Title\n- [ ] Ship it #release\n- [x] Done\n```\n#not-a-tag [[NotALink]]\n```\nSee [[plain]].",
	"/vault/tasks.md": "- [ ] Call @mom 📅 2026-10-20\n  - [ ] nested #home\nNo tags here.",
	"/vault/broken.md": "---\ntags: [unclosed\n---\nBody #fallback [[Link]]",
	"/vault/empty.md": "",
}

function entries(files: Record<string, string>): FileEntry[] {
	return Object.entries(files).map(([path, content], index) => ({
		path,
		name: path.split("/").at(-1) ?? path,
		isDir: false,
		mtime: 100 + index,
		size: content.length,
	}))
}

function mockPlatform(files: Map<string, string>, writes: Map<string, string>) {
	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFile: vi.fn(async (path: string) => {
				const content = files.get(path) ?? writes.get(path)
				if (content === undefined) throw new Error(`Missing ${path}`)
				return content
			}),
			readTextFiles: vi.fn(async (paths: string[]) =>
				paths.map((path) => {
					const content = files.get(path)
					return content === undefined ? null : { content, modifiedAt: 1 }
				}),
			),
			createDir: vi.fn(async () => undefined),
			atomicWriteFile: vi.fn(async (path: string, content: string) => {
				writes.set(path, content)
			}),
		},
	} as unknown as ReturnType<typeof getPlatform>)
}

function legacyMetadata(path: string, content: string) {
	let tags: string[]
	try {
		tags = extractAllTags(content)
	} catch {
		tags = []
	}
	return {
		tags,
		links: extractWikiLinks(extractFrontmatterBody(content)),
		tasks: parseTasks(path, content),
	}
}

function storeSnapshot() {
	const sortRecord = (record: Record<string, string[]>) =>
		Object.fromEntries(
			Object.entries(record)
				.map(([key, value]) => [key, [...value].sort()] as const)
				.sort(([left], [right]) => left.localeCompare(right)),
		)
	return {
		tagIndex: sortRecord(useTagsStore.getState().tagIndex),
		fileTags: useTagsStore.getState().fileTags,
		outgoing: useLinksStore.getState().outgoing,
		tasksByPath: useTasksStore.getState().tasksByPath,
	}
}

describe("noteMetadataIndex", () => {
	let files: Map<string, string>
	let writes: Map<string, string>

	beforeEach(() => {
		vi.useFakeTimers()
		files = new Map(Object.entries(FIXTURES))
		writes = new Map()
		mockPlatform(files, writes)
		noteMetadataIndex.reset()
	})

	afterEach(() => {
		noteMetadataIndex.reset()
		vi.useRealTimers()
	})

	it("produces the same tags, links and tasks as the three separate parsers", () => {
		for (const [path, content] of Object.entries(FIXTURES)) {
			const legacy = legacyMetadata(path, content)
			const next = extractNoteMetadata(path, content)
			if (path !== "/vault/broken.md") expect(next.tags).toEqual(legacy.tags)
			expect(next.links).toEqual(legacy.links)
			expect(next.tasks).toEqual(legacy.tasks)
		}
		expect(extractNoteMetadata("/vault/broken.md", FIXTURES["/vault/broken.md"]).tags).toEqual([
			"fallback",
		])
	})

	it("builds the stores from one pass over the vault", async () => {
		await noteMetadataIndex.build(VAULT, entries(FIXTURES))
		const { fileTags, tagIndex } = useTagsStore.getState()
		for (const [path, content] of Object.entries(FIXTURES)) {
			const legacy = legacyMetadata(path, content)
			if (path !== "/vault/broken.md") expect(fileTags[path]).toEqual(legacy.tags)
			expect(useLinksStore.getState().outgoing[path] ?? []).toEqual(legacy.links)
			expect(useTasksStore.getState().tasksByPath[path] ?? []).toEqual(legacy.tasks)
		}
		expect(tagIndex.project).toEqual(["/vault/front.md"])
		expect(useTasksStore.getState().inboxPath).toBe("/vault/.cortex/inbox.md")
	})

	it("keeps derived maps equal to a fresh rebuild after per-file updates and removals", async () => {
		await noteMetadataIndex.build(VAULT, entries(FIXTURES))
		const edits = {
			"/vault/plain.md": "Now #project and #new, links [[front]].",
			"/vault/tasks.md": "No more tasks, #home stays",
			"/vault/added.md": "---\ntags: [project]\n---\n- [ ] new task [[plain]]",
		}
		noteMetadataIndex.updateMany(
			Object.entries(edits).map(([path, content]) => ({ path, content })),
		)
		noteMetadataIndex.update("/vault/front.md", FIXTURES["/vault/front.md"])
		noteMetadataIndex.remove("/vault/broken.md")
		const incremental = storeSnapshot()

		const finalFiles: Record<string, string> = { ...FIXTURES, ...edits }
		delete finalFiles["/vault/broken.md"]
		files = new Map(Object.entries(finalFiles))
		mockPlatform(files, writes)
		noteMetadataIndex.reset()
		await noteMetadataIndex.build(VAULT, entries(finalFiles))

		expect(incremental).toEqual(storeSnapshot())
	})

	it("does not touch store state when a save leaves the metadata unchanged", async () => {
		await noteMetadataIndex.build(VAULT, entries(FIXTURES))
		const before = {
			tags: useTagsStore.getState().tagIndex,
			links: useLinksStore.getState().outgoing,
			tasks: useTasksStore.getState().tasksByPath,
		}
		noteMetadataIndex.update("/vault/plain.md", `${FIXTURES["/vault/plain.md"]}\n\nmore words`)
		expect(useTagsStore.getState().tagIndex).toBe(before.tags)
		expect(useLinksStore.getState().outgoing).toBe(before.links)
		expect(useTasksStore.getState().tasksByPath).toBe(before.tasks)
	})

	it("persists one notes index and reuses it on the next open", async () => {
		await noteMetadataIndex.build(VAULT, entries(FIXTURES))
		await vi.runAllTimersAsync()
		const persisted = writes.get("/vault/.cortex/cache/notes-index.json")
		expect(persisted).toBeDefined()
		expect([...parsePersistedNotesIndex(persisted ?? "").keys()].sort()).toEqual(
			Object.keys(FIXTURES).sort(),
		)

		noteMetadataIndex.reset()
		const readTextFiles = vi.mocked(getPlatform().fs.readTextFiles)
		readTextFiles.mockClear()
		await noteMetadataIndex.build(VAULT, entries(FIXTURES))
		expect(readTextFiles).not.toHaveBeenCalled()
		expect(useTagsStore.getState().fileTags["/vault/front.md"]).toEqual([
			"project",
			"area/work",
			"release",
		])
	})
})
