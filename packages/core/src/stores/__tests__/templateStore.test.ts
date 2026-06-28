import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../../noteCache"
import { useTemplateStore } from "../templateStore"

const vault = {
	path: "/vault",
	name: "Vault",
}

function mockPlatform(files = new Map<string, string>()) {
	const readFile = vi.fn(async (path: string) => {
		if (!files.has(path)) throw new Error(`Missing ${path}`)
		return files.get(path) ?? ""
	})
	const writeFile = vi.fn(async (path: string, content: string) => {
		files.set(path, content)
	})
	const writeFileSnapshot = vi.fn(async (path: string, content: string) => {
		files.set(path, content)
		return {
			content,
			hash: `hash:${path}`,
			metadata: { createdAt: 1, modifiedAt: 2 },
		}
	})
	const deleteFile = vi.fn(async (path: string) => {
		files.delete(path)
	})
	const createDir = vi.fn(async () => undefined)
	const hashFile = vi.fn(async (path: string) => `hash:${path}`)
	const getFileMetadata = vi.fn(async (path: string) => {
		if (!files.has(path)) throw new Error(`Missing ${path}`)
		return { createdAt: 1, modifiedAt: 2 }
	})
	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFile,
			writeFileSnapshot,
			writeFile,
			deleteFile,
			createDir,
			hashFile,
			getFileMetadata,
		},
	} as never)
	return {
		files,
		readFile,
		writeFileSnapshot,
		writeFile,
		deleteFile,
		createDir,
		hashFile,
		getFileMetadata,
	}
}

beforeEach(() => {
	noteCache.clear()
	useTemplateStore.getState().reset()
	vi.clearAllMocks()
	vi.spyOn(crypto, "randomUUID").mockReturnValue("template-1" as never)
})

describe("templateStore", () => {
	it("creates a template manifest entry and body file", async () => {
		const platform = mockPlatform()

		const template = await useTemplateStore.getState().createTemplate(vault, {
			name: "Weekly Review",
			body: "# {{ note.title }}",
			targetFolderPattern: "Reviews",
			fileNamePattern: "{{ note.title | slug }}",
		})

		expect(template.id).toBe("template-1")
		expect(platform.writeFile).toHaveBeenCalledWith(
			"/vault/.cortex/templates/template-1.md",
			"# {{ note.title }}",
		)
		expect(
			JSON.parse(platform.files.get("/vault/.cortex/templates/manifest.json") ?? ""),
		).toMatchObject({
			version: 1,
			templates: [
				{
					id: "template-1",
					name: "Weekly Review",
					bodyPath: "template-1.md",
					targetFolderPattern: "Reviews",
					fileNamePattern: "{{ note.title | slug }}",
				},
			],
		})
	})

	it("renders and creates a note from a template without overwriting existing files", async () => {
		const platform = mockPlatform(new Map([["/vault/Reviews/weekly-review.md", "existing"]]))
		await useTemplateStore.getState().createTemplate(vault, {
			name: "Weekly Review",
			body: "# {{ note.title }}\n{{ date.today }}",
			targetFolderPattern: "Reviews",
			fileNamePattern: "{{ note.title | slug }}",
		})

		const filePath = await useTemplateStore.getState().createNoteFromTemplate(vault, {
			templateId: "template-1",
			noteTitle: "Weekly Review",
			now: new Date(2026, 5, 18, 10, 0, 0),
		})

		expect(filePath).toBe("/vault/Reviews/weekly-review 2.md")
		expect(platform.files.get(filePath)).toBe("# Weekly Review\n2026-06-18")
		expect(noteCache.getEntry(filePath)).toMatchObject({
			content: "# Weekly Review\n2026-06-18",
			dirty: false,
			hash: `hash:${filePath}`,
		})
		expect(platform.writeFileSnapshot).toHaveBeenCalledWith(filePath, "# Weekly Review\n2026-06-18")
		expect(platform.hashFile).not.toHaveBeenCalled()
	})

	it("keeps a template-created note when post-write fingerprint reads fail", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
		try {
			const platform = mockPlatform()
			platform.writeFileSnapshot.mockRejectedValue(new Error("snapshot write unavailable"))
			platform.hashFile.mockRejectedValue(new Error("file is temporarily locked"))
			await useTemplateStore.getState().createTemplate(vault, {
				name: "Weekly Review",
				body: "# {{ note.title }}",
				targetFolderPattern: "Reviews",
				fileNamePattern: "{{ note.title | slug }}",
			})

			const filePath = await useTemplateStore.getState().createNoteFromTemplate(vault, {
				templateId: "template-1",
				noteTitle: "Weekly Review",
			})

			expect(filePath).toBe("/vault/Reviews/weekly-review.md")
			expect(platform.files.get(filePath)).toBe("# Weekly Review")
			expect(noteCache.getEntry(filePath)).toMatchObject({
				content: "# Weekly Review",
				dirty: false,
				localCreatedAt: expect.any(Number),
			})
			expect(noteCache.getEntry(filePath)?.hash).toContain("local-created:")
		} finally {
			consoleError.mockRestore()
		}
	})

	it("falls back to the note title slug when a saved title pattern renders empty", async () => {
		mockPlatform()
		await useTemplateStore.getState().createTemplate(vault, {
			name: "Weekly Review",
			body: "# {{ note.title }}",
			targetFolderPattern: "Reviews",
			fileNamePattern: "{{ missing.property }}",
		})

		const preview = await useTemplateStore.getState().previewNoteFromTemplate(vault, {
			templateId: "template-1",
			noteTitle: "Weekly Review",
		})

		expect(preview.fileName).toBe("weekly-review.md")
	})

	it("rejects generated paths outside the vault", async () => {
		mockPlatform()
		await useTemplateStore.getState().createTemplate(vault, {
			name: "Unsafe",
			body: "",
			targetFolderPattern: "../outside",
			fileNamePattern: "{{ note.title | slug }}",
		})

		await expect(
			useTemplateStore.getState().previewNoteFromTemplate(vault, {
				templateId: "template-1",
				noteTitle: "Note",
			}),
		).rejects.toThrow("Target folder")
	})
})
