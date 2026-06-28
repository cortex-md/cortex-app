import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_APP_SETTINGS } from "./defaults"

const mockPlatform = vi.hoisted(() => ({
	fs: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
	storage: {
		getAppDataDir: vi.fn(),
	},
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => mockPlatform),
}))

beforeEach(() => {
	vi.resetModules()
	mockPlatform.fs.readFile.mockReset()
	mockPlatform.fs.writeFile.mockResolvedValue(undefined)
	mockPlatform.storage.getAppDataDir.mockResolvedValue("/home/user/.cortex")
})

describe("useSettingsStore", () => {
	it("refreshes the local appearance snapshot after updating native window effects", async () => {
		const { useSettingsStore } = await import("./store")
		const { AppSettingsSchema } = await import("./types")

		useSettingsStore.setState({
			settings: AppSettingsSchema.parse(DEFAULT_APP_SETTINGS),
			isLoading: false,
			error: null,
		})

		await useSettingsStore.getState().updateSetting("appearance", "nativeWindowEffects", false)

		expect(useSettingsStore.getState().settings.appearance.nativeWindowEffects).toBe(false)
		expect(mockPlatform.fs.writeFile).toHaveBeenCalledWith(
			"/home/user/.cortex/settings.json",
			expect.stringContaining('"nativeWindowEffects": false'),
		)
	})
})
