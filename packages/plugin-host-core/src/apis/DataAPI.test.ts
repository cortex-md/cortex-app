import type { PluginCapability } from "@cortex.md/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pluginStore } from "../pluginStore"
import { createDataAPI } from "./DataAPI"

const testState = vi.hoisted(() => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	deleteFile: vi.fn(),
	createDir: vi.fn(),
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => ({
		fs: {
			readFile: testState.readFile,
			writeFile: testState.writeFile,
			deleteFile: testState.deleteFile,
			createDir: testState.createDir,
		},
	}),
}))

function registerPlugin(capabilities: PluginCapability[] = []): void {
	pluginStore.getState().registerPlugin({
		id: "data-plugin",
		name: "Data Plugin",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Stores plugin data",
		icon: "database",
		main: "index.js",
		capabilities,
	})
}

describe("DataAPI", () => {
	beforeEach(() => {
		testState.readFile.mockReset()
		testState.writeFile.mockReset()
		testState.deleteFile.mockReset()
		testState.createDir.mockReset()
	})

	afterEach(() => {
		pluginStore.getState().reset()
	})

	it("requires the data capability", async () => {
		registerPlugin()
		const api = createDataAPI("data-plugin", () => "/vault")

		await expect(api.read("cache.json")).rejects.toThrow("data capability")
		await expect(api.write("cache.json", "{}")).rejects.toThrow("data capability")
		await expect(api.delete("cache.json")).rejects.toThrow("data capability")
		expect(() => api.getDataPath()).toThrow("data capability")
	})

	it("scopes data files to the plugin data directory", async () => {
		registerPlugin(["data"])
		testState.readFile.mockResolvedValue("{}")
		const api = createDataAPI("data-plugin", () => "/vault")

		await expect(api.read("cache.json")).resolves.toBe("{}")
		await api.write("cache.json", "{}")
		await api.delete("cache.json")

		expect(testState.readFile).toHaveBeenCalledWith(
			"/vault/.cortex/plugins/data-plugin/data/cache.json",
		)
		expect(testState.createDir).toHaveBeenCalledWith("/vault/.cortex/plugins/data-plugin/data")
		expect(testState.writeFile).toHaveBeenCalledWith(
			"/vault/.cortex/plugins/data-plugin/data/cache.json",
			"{}",
		)
		expect(testState.deleteFile).toHaveBeenCalledWith(
			"/vault/.cortex/plugins/data-plugin/data/cache.json",
		)
		expect(api.getDataPath()).toBe("/vault/.cortex/plugins/data-plugin/data")
	})
})
