import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	readLastSeenAppVersion,
	writeLastSeenAppVersion,
} from "../../../features/app-updates/appUpdateChangelogMarker"

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
			getAppDataDir: vi.fn().mockResolvedValue("/app-data"),
		},
	} as never)

	return { files, createDir }
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("app update changelog marker", () => {
	it("returns null when no app update marker exists", async () => {
		setMemoryPlatform()

		await expect(readLastSeenAppVersion()).resolves.toBeNull()
	})

	it("writes and reads the last seen app version", async () => {
		const { files, createDir } = setMemoryPlatform()

		await writeLastSeenAppVersion("0.1.0", new Date("2026-06-21T00:00:00Z"))

		expect(createDir).toHaveBeenCalledWith("/app-data")
		expect(JSON.parse(files.get("/app-data/app-updates.json") ?? "{}")).toEqual({
			version: 1,
			lastSeenAppVersion: "0.1.0",
			lastSeenAt: "2026-06-21T00:00:00.000Z",
		})
		await expect(readLastSeenAppVersion()).resolves.toBe("0.1.0")
	})
})
