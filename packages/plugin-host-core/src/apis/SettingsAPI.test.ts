import type { PluginCapability } from "@cortex.md/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pluginStore } from "../pluginStore"
import { createSettingsAPI } from "./SettingsAPI"

const testState = vi.hoisted(() => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	createDir: vi.fn(),
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => ({
		fs: {
			readFile: testState.readFile,
			writeFile: testState.writeFile,
			createDir: testState.createDir,
		},
	}),
}))

function registerPlugin(capabilities: PluginCapability[] = []): void {
	pluginStore.getState().registerPlugin({
		id: "settings-plugin",
		name: "Settings Plugin",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Stores plugin settings",
		icon: "settings",
		main: "index.js",
		capabilities,
	})
}

describe("SettingsAPI", () => {
	beforeEach(() => {
		testState.readFile.mockReset()
		testState.writeFile.mockReset()
		testState.createDir.mockReset()
	})

	afterEach(() => {
		pluginStore.getState().reset()
	})

	it("does not persist or notify when a setting value is unchanged", async () => {
		registerPlugin(["settings"])
		testState.readFile.mockResolvedValue('{"limit":3}')
		const api = createSettingsAPI("settings-plugin", () => "/vault")
		const listener = vi.fn()

		api.onChange("limit", listener)
		await api.set("limit", 3)

		expect(testState.readFile).toHaveBeenCalledWith(
			"/vault/.cortex/plugins/settings-plugin/settings.json",
		)
		expect(testState.createDir).not.toHaveBeenCalled()
		expect(testState.writeFile).not.toHaveBeenCalled()
		expect(listener).not.toHaveBeenCalled()
	})

	it("persists changed settings and notifies listeners", async () => {
		registerPlugin(["settings"])
		testState.readFile.mockResolvedValue('{"limit":3}')
		const api = createSettingsAPI("settings-plugin", () => "/vault")
		const listener = vi.fn()

		api.onChange("limit", listener)
		await api.set("limit", 5)

		expect(testState.createDir).toHaveBeenCalledWith("/vault/.cortex/plugins/settings-plugin")
		expect(testState.writeFile).toHaveBeenCalledWith(
			"/vault/.cortex/plugins/settings-plugin/settings.json",
			'{\n\t"limit": 5\n}',
		)
		expect(listener).toHaveBeenCalledWith(5, 3)
	})
})
