import { getPlatform } from "@cortex/platform"
import { CortexPlugin, type PluginManifest } from "@cortex.md/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	loadEnabledPlugins,
	registerCommunityPlugin,
	unregisterCommunityPlugin,
} from "./PluginLifecycle"
import { pluginStore } from "./pluginStore"

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(),
}))

const readFile = vi.fn()
const writeFile = vi.fn()

function createManifest(id: string): PluginManifest {
	return {
		id,
		name: id,
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Test plugin",
		icon: "plug",
		main: "index.js",
		capabilities: [],
	}
}

describe("loadEnabledPlugins", () => {
	beforeEach(() => {
		readFile.mockReset()
		writeFile.mockReset()
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile,
			},
		} as never)
		pluginStore.getState().reset()
	})

	afterEach(() => {
		unregisterCommunityPlugin("invalid-json-plugin")
		pluginStore.getState().reset()
		vi.restoreAllMocks()
	})

	it("does not enable every plugin when plugins.json is invalid", async () => {
		const onload = vi.fn()
		class TestPlugin extends CortexPlugin {
			async onload() {
				onload()
			}
		}
		registerCommunityPlugin(
			createManifest("invalid-json-plugin"),
			{ default: TestPlugin },
			{
				dirPath: "/vault/.cortex/plugins/invalid-json-plugin",
			},
		)
		readFile.mockResolvedValue("{")
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		await loadEnabledPlugins("/vault", () => "/vault")

		expect(onload).not.toHaveBeenCalled()
		expect(writeFile).not.toHaveBeenCalled()
		expect(pluginStore.getState().plugins["invalid-json-plugin"]?.status).toBe("loaded")
		expect(errorSpy).toHaveBeenCalledWith(
			"[Plugin operation failed]",
			expect.objectContaining({ operation: "read-enabled", pluginId: "registry" }),
		)
	})
})
