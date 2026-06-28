import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAppStore } from "../../stores/appStore"

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
		app: {
			getCurrentAppVersion: vi.fn().mockResolvedValue("0.1.0"),
			openExternalUrl: vi.fn().mockResolvedValue(undefined),
			resolveFileAssetUrl: vi.fn((path: string) => `asset://${path}`),
		},
		fs: { readFile, writeFile, createDir },
		storage: {
			getAppDataDir: vi.fn().mockResolvedValue("/app-data"),
		},
	} as never)

	return { files, createDir }
}

beforeEach(() => {
	useAppStore.setState({
		version: null,
		firstRunOnboardingSeen: null,
	})
	vi.clearAllMocks()
})

describe("appStore onboarding", () => {
	it("loads a missing first-run marker and writes the seen marker", async () => {
		const { files, createDir } = setMemoryPlatform()

		await useAppStore.getState().loadFirstRunOnboarding()

		expect(useAppStore.getState().firstRunOnboardingSeen).toBe(false)

		await useAppStore.getState().markFirstRunOnboardingSeen()

		expect(createDir).toHaveBeenCalledWith("/app-data")
		expect(useAppStore.getState().firstRunOnboardingSeen).toBe(true)
		expect(JSON.parse(files.get("/app-data/onboarding.json") ?? "{}")).toEqual({
			version: 1,
			firstRunOnboardingSeenAt: expect.any(String),
		})
	})
})
