import { getPlatform } from "@cortex/platform"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	DEFAULT_APP_SETTINGS,
	DEFAULT_APPEARANCE_SETTINGS,
	DEFAULT_EDITOR_SETTINGS,
	SYSTEM_FONT_FAMILY,
} from "../defaults"
import { SettingsManager } from "../SettingsManager"
import { AppearanceSettingsSchema, AppSettingsSchema, EditorSettingsSchema } from "../types"

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		fs: {
			readFile: vi.fn(),
			writeFile: vi.fn(),
		},
		storage: {
			getAppDataDir: vi.fn(),
		},
	})),
}))

const mockPlatform = {
	fs: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
	storage: {
		getAppDataDir: vi.fn(),
	},
}

beforeEach(() => {
	vi.mocked(getPlatform).mockReturnValue(mockPlatform as never)
	mockPlatform.fs.readFile.mockReset()
	mockPlatform.fs.writeFile.mockResolvedValue(undefined)
	mockPlatform.storage.getAppDataDir.mockResolvedValue("/home/user/.cortex")
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
	vi.clearAllMocks()
})

describe("constructor", () => {
	it("creates with default settings when no initial provided", () => {
		const manager = new SettingsManager()
		expect(manager.getAll()).toEqual(AppSettingsSchema.parse(DEFAULT_APP_SETTINGS))
	})

	it("merges provided initial values with defaults", () => {
		const manager = new SettingsManager({ general: { autoOpenLastVault: false } })
		expect(manager.getSection("general").autoOpenLastVault).toBe(false)
		expect(manager.getSection("editor").wordWrap).toBe(true)
	})
})

describe("loadFromVault()", () => {
	it("reads settings from .cortex/app.json in vault path", async () => {
		mockPlatform.fs.readFile.mockResolvedValue(
			JSON.stringify({ editor: { wordWrap: false, tabSize: 4 } }),
		)
		const manager = new SettingsManager()
		await manager.loadFromVault("/my/vault")
		expect(mockPlatform.fs.readFile).toHaveBeenCalledWith("/my/vault/.cortex/app.json")
		expect(manager.getSection("editor").wordWrap).toBe(false)
		expect(manager.getSection("editor").tabSize).toBe(4)
	})

	it("falls back to defaults when file does not exist", async () => {
		mockPlatform.fs.readFile.mockRejectedValue(new Error("File not found"))
		const manager = new SettingsManager()
		await manager.loadFromVault("/my/vault")
		expect(manager.getSection("editor").wordWrap).toBe(true)
	})

	it("falls back to defaults when file contains invalid JSON", async () => {
		mockPlatform.fs.readFile.mockResolvedValue("not valid json")
		const manager = new SettingsManager()
		await manager.loadFromVault("/my/vault")
		expect(manager.getSection("editor").tabSize).toBe(2)
	})
})

describe("get()", () => {
	it("returns stored value for a setting key", async () => {
		mockPlatform.fs.readFile.mockResolvedValue(JSON.stringify({ editor: { tabSize: 4 } }))
		const manager = new SettingsManager()
		await manager.loadFromVault("/vault")
		expect(manager.get("editor", "tabSize")).toBe(4)
	})

	it("returns default value for unset key", () => {
		const manager = new SettingsManager()
		expect(manager.get("appearance", "uiFontSize")).toBe(DEFAULT_APPEARANCE_SETTINGS.uiFontSize)
	})
})

describe("appearance schema", () => {
	it("uses system font defaults", () => {
		const appearance = AppearanceSettingsSchema.parse({})

		expect(appearance.uiFontFamily).toBe(SYSTEM_FONT_FAMILY)
		expect(appearance.editorFontFamily).toBe(SYSTEM_FONT_FAMILY)
		expect(appearance.nativeWindowEffects).toBe(true)
	})

	it("accepts the legacy native content surface setting", () => {
		const appearance = AppearanceSettingsSchema.parse({ nativeContentSurface: false })

		expect(appearance.nativeWindowEffects).toBe(false)
	})

	it("uses the shared editor font size default", () => {
		const settings = AppSettingsSchema.parse({})

		expect(settings.editor).toMatchObject(DEFAULT_EDITOR_SETTINGS)
		expect(settings.appearance.editorFontSize).toBe(DEFAULT_APPEARANCE_SETTINGS.editorFontSize)
	})

	it("accepts legacy lineHeight settings", () => {
		const appearance = AppearanceSettingsSchema.parse({ lineHeight: 1.8 })

		expect(appearance.lineHeight).toBe(1.8)
	})
})

describe("getSection()", () => {
	it("returns the full section settings", () => {
		const manager = new SettingsManager()
		const editorSettings = manager.getSection("editor")
		expect(editorSettings).toMatchObject({
			tabSize: 2,
			wordWrap: true,
			folding: true,
			showLineNumbers: true,
			vimMode: false,
			slashCommands: true,
			markdownToolbar: false,
		})
	})

	it("parses the optional Markdown toolbar setting", () => {
		const settings = EditorSettingsSchema.parse({ markdownToolbar: true })

		expect(settings.markdownToolbar).toBe(true)
	})
})

describe("set()", () => {
	it("updates the cached value immediately", async () => {
		const manager = new SettingsManager()
		await manager.set("editor", "tabSize", 4)
		expect(manager.get("editor", "tabSize")).toBe(4)
	})

	it("schedules a flush (not immediate)", async () => {
		const manager = new SettingsManager()
		await manager.loadFromVault("/vault")
		await manager.set("editor", "wordWrap", false)
		expect(mockPlatform.fs.writeFile).not.toHaveBeenCalled()
	})

	it("notifies subscribers with change event", async () => {
		const manager = new SettingsManager()
		const listener = vi.fn()
		manager.subscribe(listener)
		await manager.set("editor", "tabSize", 8)
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				section: "editor",
				key: "tabSize",
				oldValue: 2,
				newValue: 8,
			}),
		)
	})

	it("debounces multiple calls to flush only once after 1 second", async () => {
		const manager = new SettingsManager()
		await manager.loadFromVault("/vault")
		await manager.set("editor", "tabSize", 4)
		await manager.set("editor", "tabSize", 6)
		await manager.set("editor", "tabSize", 8)
		vi.advanceTimersByTime(1001)
		await vi.runAllTimersAsync()
		expect(mockPlatform.fs.writeFile).toHaveBeenCalledTimes(1)
	})

	it("writes native window effects to global settings immediately", async () => {
		const manager = new SettingsManager()
		await manager.set("appearance", "nativeWindowEffects", false)

		expect(mockPlatform.fs.writeFile).toHaveBeenCalledWith(
			"/home/user/.cortex/settings.json",
			expect.stringContaining('"nativeWindowEffects": false'),
		)
	})

	it("rejects invalid values before mutating or notifying listeners", async () => {
		const manager = new SettingsManager()
		await manager.loadFromVault("/vault")
		const listener = vi.fn()
		manager.subscribe(listener)

		await expect(manager.set("editor", "tabSize", 99)).rejects.toThrow()

		expect(manager.get("editor", "tabSize")).toBe(2)
		expect(listener).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1001)
		await vi.runAllTimersAsync()
		expect(mockPlatform.fs.writeFile).not.toHaveBeenCalled()
	})
})

describe("subscribe()", () => {
	it("calls listener on every set()", async () => {
		const manager = new SettingsManager()
		const listener = vi.fn()
		manager.subscribe(listener)
		await manager.set("appearance", "uiFontSize", 16)
		await manager.set("general", "autoOpenLastVault", false)
		expect(listener).toHaveBeenCalledTimes(2)
	})

	it("returns unsubscribe function that stops notifications", async () => {
		const manager = new SettingsManager()
		const listener = vi.fn()
		const unsubscribe = manager.subscribe(listener)
		unsubscribe()
		await manager.set("editor", "tabSize", 4)
		expect(listener).not.toHaveBeenCalled()
	})
})

describe("flush()", () => {
	it("writes settings JSON to the vault config path", async () => {
		const manager = new SettingsManager()
		await manager.loadFromVault("/my/vault")
		await manager.flush()
		expect(mockPlatform.fs.writeFile).toHaveBeenCalledWith(
			"/my/vault/.cortex/app.json",
			expect.stringContaining('"editor"'),
		)
	})

	it("is a no-op when no vault path is set", async () => {
		const manager = new SettingsManager()
		await manager.flush()
		expect(mockPlatform.fs.writeFile).not.toHaveBeenCalled()
	})

	it("writes valid JSON that can be round-tripped", async () => {
		const manager = new SettingsManager()
		await manager.loadFromVault("/vault")
		await manager.set("editor", "tabSize", 4)
		vi.advanceTimersByTime(1001)
		await vi.runAllTimersAsync()
		const writtenContent = mockPlatform.fs.writeFile.mock.calls[0][1]
		const parsed = JSON.parse(writtenContent)
		expect(parsed.editor.tabSize).toBe(4)
		expect(parsed.appearance.nativeWindowEffects).toBeUndefined()
	})
})

describe("getAll()", () => {
	it("returns a shallow copy of all settings", () => {
		const manager = new SettingsManager()
		const all = manager.getAll()
		expect(all).toHaveProperty("general")
		expect(all).toHaveProperty("appearance")
		expect(all).toHaveProperty("editor")
		expect(all).toHaveProperty("files")
		expect(all).toHaveProperty("hotkeys")
	})

	it("returns a snapshot of the settings at call time", () => {
		const manager = new SettingsManager()
		const all = manager.getAll()
		expect(all).toHaveProperty("editor")
		expect(all.editor.tabSize).toBe(2)
	})
})
