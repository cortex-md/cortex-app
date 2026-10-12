import { commandRegistry } from "@cortex/commands"
import { getPlatform } from "@cortex/platform"
import { resetCustomPropertyTypes } from "@cortex/properties"
import type { PluginDefinition } from "@cortex.md/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createCodeMirrorActiveEditor } from "./activeEditor"
import { setEditorViewRef } from "./editorViews"
import { type PluginHostServices, resetNotificationRateLimits } from "./pluginContext"
import { createPluginHost } from "./pluginHost"
import { resetPluginStore, usePluginStore } from "./pluginStore"

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(),
}))

const platform = {
	capabilities: ["notifications"],
	notifications: {
		getPermission: vi.fn(async () => "granted"),
		send: vi.fn(async () => ({ delivered: true })),
	},
	fs: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		createDir: vi.fn(),
		deleteFile: vi.fn(),
	},
}

function createServices(overrides: Partial<PluginHostServices> = {}): PluginHostServices {
	return {
		getVaultPath: () => "/vault",
		workspace: {
			openFile: vi.fn(),
			openView: vi.fn(),
			openMarkdownTab: vi.fn(),
			getOpenFiles: () => [],
			subscribeActiveFile: () => () => {},
		},
		activeEditor: createCodeMirrorActiveEditor({ getFilePath: () => null }),
		editorRuntime: { reconfigure: vi.fn() },
		bookmarks: {
			list: () => [],
			add: vi.fn(),
			remove: vi.fn(),
			toggle: vi.fn(),
			isBookmarked: () => false,
			subscribe: () => () => {},
		},
		metadata: { parseFrontmatter: () => null, extractTags: () => [], getAllTags: () => [] },
		theme: { getActiveThemeName: () => "ink", subscribe: () => () => {} },
		community: null,
		...overrides,
	}
}

function createPlugin(
	id: string,
	definition: Omit<PluginDefinition, "manifest"> & { permissions?: string[] } = {},
): PluginDefinition {
	const { permissions, ...rest } = definition
	return {
		...rest,
		manifest: {
			id,
			name: id,
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Cortex",
			description: "Test plugin",
			icon: "plug",
			permissions: permissions as PluginDefinition["manifest"]["permissions"],
		},
	}
}

beforeEach(() => {
	vi.mocked(getPlatform).mockReturnValue(platform as never)
	platform.fs.readFile.mockReset()
	platform.fs.writeFile.mockReset()
	platform.fs.createDir.mockReset()
	platform.notifications.send.mockClear()
	resetNotificationRateLimits()
})

afterEach(() => {
	resetPluginStore()
	commandRegistry.clear()
	resetCustomPropertyTypes()
	setEditorViewRef(null)
	vi.restoreAllMocks()
})

describe("plugin host lifecycle", () => {
	it("does not enable every plugin when plugins.json is invalid", async () => {
		const activate = vi.fn()
		const host = createPluginHost(createServices())
		host.registerBundledPlugins([
			createPlugin("invalid-json-plugin", { activation: "startup", activate }),
		])
		platform.fs.readFile.mockResolvedValue("{")
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		await host.loadEnabledPlugins()

		expect(activate).not.toHaveBeenCalled()
		expect(platform.fs.writeFile).not.toHaveBeenCalled()
		expect(usePluginStore.getState().plugins["invalid-json-plugin"]?.status).toBe("loaded")
		expect(errorSpy).toHaveBeenCalledWith(
			"[Plugin operation failed]",
			expect.objectContaining({ operation: "read-enabled", pluginId: "registry" }),
		)
	})
})
