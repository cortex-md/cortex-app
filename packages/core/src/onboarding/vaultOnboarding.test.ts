import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ensureVaultOnboardingNote } from "./vaultOnboarding"

function setMemoryPlatform(initialFiles: Record<string, string> = {}) {
	const files = new Map(Object.entries(initialFiles))
	const readFile = vi.fn(async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw new Error("File not found")
		return content
	})
	const writeFile = vi.fn(async (path: string, content: string) => {
		files.set(path, content)
	})
	const createDir = vi.fn().mockResolvedValue(undefined)

	vi.mocked(getPlatform).mockReturnValue({
		fs: { readFile, writeFile, createDir },
		storage: {
			getVaultConfigDir: vi.fn(async (vaultPath: string) => `${vaultPath}/.cortex`),
		},
	} as never)

	return { files, readFile, writeFile, createDir }
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("vault onboarding", () => {
	it("creates the welcome note and vault marker", async () => {
		const { files, createDir } = setMemoryPlatform()

		const result = await ensureVaultOnboardingNote("/vault", new Date("2026-01-02T00:00:00Z"))

		expect(result).toEqual({ created: true, notePath: "/vault/Welcome to Cortex.md" })
		expect(files.get("/vault/Welcome to Cortex.md")).toContain("# Welcome to Cortex")
		expect(files.get("/vault/Welcome to Cortex.md")).toContain("cortex-onboarding-version: 1")
		expect(createDir).toHaveBeenCalledWith("/vault/.cortex")
		expect(JSON.parse(files.get("/vault/.cortex/onboarding.json") ?? "{}")).toEqual({
			version: 1,
			notePath: "Welcome to Cortex.md",
			createdAt: "2026-01-02T00:00:00.000Z",
		})
	})

	it("does not overwrite an existing welcome note", async () => {
		const { files } = setMemoryPlatform({
			"/vault/Welcome to Cortex.md": "Existing note",
		})

		const result = await ensureVaultOnboardingNote("/vault")

		expect(result).toEqual({ created: true, notePath: "/vault/Welcome to Cortex 2.md" })
		expect(files.get("/vault/Welcome to Cortex.md")).toBe("Existing note")
		expect(files.get("/vault/Welcome to Cortex 2.md")).toContain("# Welcome to Cortex")
		expect(JSON.parse(files.get("/vault/.cortex/onboarding.json") ?? "{}").notePath).toBe(
			"Welcome to Cortex 2.md",
		)
	})

	it("does not recreate the note when the vault marker exists", async () => {
		const { writeFile } = setMemoryPlatform({
			"/vault/.cortex/onboarding.json": JSON.stringify({
				version: 1,
				notePath: "Welcome to Cortex.md",
				createdAt: "2026-01-02T00:00:00.000Z",
			}),
		})

		const result = await ensureVaultOnboardingNote("/vault")

		expect(result).toEqual({ created: false, notePath: null })
		expect(writeFile).not.toHaveBeenCalled()
	})
})
