import { initPlatform, type Platform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { exportNote, importFiles } from "./service"

function createPlatform(files: Record<string, string>, binaryFiles: Record<string, number[]> = {}) {
	const written: Record<string, string> = {}
	const writtenBinary: Record<string, number[]> = {}
	const platform = {
		fs: {
			atomicWriteFile: vi.fn(async (path: string, content: string) => {
				written[path] = content
			}),
			readBinaryFile: vi.fn(async (path: string) => binaryFiles[path] ?? []),
			readFile: vi.fn(async (path: string) => files[path] ?? ""),
			writeBinaryFile: vi.fn(async (path: string, data: number[]) => {
				writtenBinary[path] = data
			}),
		},
		vault: {
			scanVault: vi.fn(async () => [
				{ path: "/vault/Existing.md", name: "Existing.md", isDir: false },
			]),
		},
		documentExport: {
			exportHtmlToPdf: vi.fn(async () => {}),
		},
		documentImport: {
			extractPdfText: vi.fn(async ({ path }: { path: string }) => ({
				pages:
					path === "/imports/empty.pdf"
						? []
						: [
								{ pageNumber: 1, text: "First page text\n\n\n" },
								{ pageNumber: 2, text: "Second page text" },
							],
			})),
		},
	} as unknown as Platform
	initPlatform(platform)
	return { platform, written, writtenBinary }
}

describe("import/export service", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it("imports CSV files into unique Markdown table notes", async () => {
		const { written } = createPlatform({
			"/imports/Existing.csv": "Name,Value\nA,\"B, C\"",
		})

		const result = await importFiles({
			vaultPath: "/vault",
			sourcePaths: ["/imports/Existing.csv"],
		})

		expect(result.importedCount).toBe(1)
		expect(written["/vault/Existing 2.md"]).toContain("| Name | Value |")
		expect(written["/vault/Existing 2.md"]).toContain("| A | B, C |")
	})

	it("imports PDFs by extracting text into Markdown notes", async () => {
		const { platform, written, writtenBinary } = createPlatform({}, { "/imports/Spec.pdf": [1, 2, 3] })

		const result = await importFiles({
			vaultPath: "/vault",
			sourcePaths: ["/imports/Spec.pdf"],
		})

		expect(result.importedCount).toBe(1)
		expect(platform.documentImport?.extractPdfText).toHaveBeenCalledWith({ path: "/imports/Spec.pdf" })
		expect(writtenBinary["/vault/attachments/imports/Spec.pdf"]).toBeUndefined()
		expect(written["/vault/Spec.md"]).toContain("# Spec")
		expect(written["/vault/Spec.md"]).toContain("## Page 1\n\nFirst page text")
		expect(written["/vault/Spec.md"]).toContain("## Page 2\n\nSecond page text")
	})

	it("fails PDF imports without extractable text instead of creating link-only notes", async () => {
		const { written } = createPlatform({})

		const result = await importFiles({
			vaultPath: "/vault",
			sourcePaths: ["/imports/empty.pdf"],
		})

		expect(result.importedCount).toBe(0)
		expect(result.failedCount).toBe(1)
		expect(result.results[0].error).toBe("PDF contains no extractable text")
		expect(written["/vault/empty.md"]).toBeUndefined()
	})

	it("exports the first Markdown table as CSV", async () => {
		const { written } = createPlatform({
			"/vault/Table.md": "# Table\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
		})

		await exportNote({
			sourcePath: "/vault/Table.md",
			format: "csv",
			targetPath: "/exports/Table.csv",
		})

		expect(written["/exports/Table.csv"]).toBe("A,B\n1,2")
	})

	it("exports PDFs through the platform document bridge", async () => {
		const { platform } = createPlatform({
			"/vault/Note.md": "# Hello",
		})

		const result = await exportNote({
			sourcePath: "/vault/Note.md",
			format: "pdf",
			targetPath: "/exports/Note.pdf",
		})

		expect(result.targetPath).toBe("/exports/Note.pdf")
		expect(platform.documentExport?.exportHtmlToPdf).toHaveBeenCalledWith(
			expect.objectContaining({ targetPath: "/exports/Note.pdf", title: "Note" }),
		)
	})
})
