import { bench, vi } from "vitest"
import { projectRawNote } from "../../packages/properties/src"

const mockReadFileSnapshot = vi.fn()
const mockHashFile = vi.fn()
const mockGetFileMetadata = vi.fn()
const notePath = "/vault/bench.md"
const noteContent = "# Bench\n\nBody".repeat(100)
const largeNoteContent = `---
tags:
  - benchmark
---

${"# Large Bench\n\nBody with [[links]], #tags, and table-ish content.\n\n".repeat(20_000)}`
const opensPerSample = 100

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		fs: {
			readFileSnapshot: mockReadFileSnapshot,
			writeFile: vi.fn().mockResolvedValue(undefined),
			hashFile: mockHashFile,
			getFileMetadata: mockGetFileMetadata,
		},
	})),
}))

mockReadFileSnapshot.mockResolvedValue({
	content: noteContent,
	hash: "hash-bench",
	metadata: { createdAt: 1, modifiedAt: 2 },
})
mockHashFile.mockResolvedValue("hash-bench")
mockGetFileMetadata.mockResolvedValue({ createdAt: 1, modifiedAt: 2 })

const { noteCache } = await import("../../packages/core/src/noteCache")

bench(
	"open preloaded note",
	async () => {
		noteCache.clear()
		for (let index = 0; index < opensPerSample; index++) {
			noteCache.openTab(notePath)
			await noteCache.readEntry(notePath)
			await noteCache.closeTab(notePath)
			noteCache.forget(notePath)
		}
		noteCache.clear()
	},
	{ iterations: 20 },
)

bench(
	"open cached note",
	async () => {
		noteCache.clear()
		for (let index = 0; index < opensPerSample; index++) {
			noteCache.primeClean(notePath, noteContent, "hash-bench", {
				metadata: { createdAt: 1, modifiedAt: 2 },
			})
			noteCache.openTab(notePath)
			await noteCache.readEntry(notePath)
			await noteCache.closeTab(notePath)
			noteCache.forget(notePath)
		}
		noteCache.clear()
	},
	{ iterations: 20 },
)

bench(
	"open projected note from cold NoteCache",
	async () => {
		noteCache.clear()
		for (let index = 0; index < opensPerSample; index++) {
			noteCache.openTab(notePath)
			const entry = await noteCache.readEntry(notePath)
			projectRawNote(entry.content)
			await noteCache.closeTab(notePath)
			noteCache.forget(notePath)
		}
		noteCache.clear()
	},
	{ iterations: 20 },
)

bench(
	"open projected cached note",
	async () => {
		noteCache.clear()
		for (let index = 0; index < opensPerSample; index++) {
			noteCache.primeClean(notePath, noteContent, "hash-bench", {
				metadata: { createdAt: 1, modifiedAt: 2 },
			})
			noteCache.openTab(notePath)
			const entry = await noteCache.readEntry(notePath)
			projectRawNote(entry.content)
			await noteCache.closeTab(notePath)
			noteCache.forget(notePath)
		}
		noteCache.clear()
	},
	{ iterations: 20 },
)

bench(
	"open projected large note from cold NoteCache",
	async () => {
		noteCache.clear()
		mockReadFileSnapshot.mockResolvedValue({
			content: largeNoteContent,
			hash: "hash-large",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
		for (let index = 0; index < 10; index++) {
			noteCache.openTab(notePath)
			const entry = await noteCache.readEntry(notePath)
			projectRawNote(entry.content)
			await noteCache.closeTab(notePath)
			noteCache.forget(notePath)
		}
		mockReadFileSnapshot.mockResolvedValue({
			content: noteContent,
			hash: "hash-bench",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
		noteCache.clear()
	},
	{ iterations: 10 },
)
