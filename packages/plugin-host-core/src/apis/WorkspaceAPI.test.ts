import type { PluginCapability } from "@cortex.md/api"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pluginStore } from "../pluginStore"
import { createWorkspaceAPI, setWorkspaceFunctions } from "./WorkspaceAPI"

function registerPlugin(capabilities: PluginCapability[] = []): void {
	pluginStore.getState().registerPlugin({
		id: "intro-plugin",
		name: "Intro Plugin",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Test plugin",
		icon: "book-open",
		main: "index.js",
		capabilities,
	})
}

describe("WorkspaceAPI", () => {
	const openMarkdownTab = vi.fn()
	const openView = vi.fn()

	beforeEach(() => {
		openMarkdownTab.mockClear()
		openView.mockClear()
		setWorkspaceFunctions({
			openFile: vi.fn(),
			openView,
			openMarkdownTab,
			getOpenFiles: () => [],
			subscribeActiveFile: () => () => {},
		})
	})

	afterEach(() => {
		pluginStore.getState().reset()
	})

	it("forwards Markdown tabs to the host bridge with the plugin id", () => {
		registerPlugin(["workspace:tabs", "ui:views"])
		const workspace = createWorkspaceAPI("intro-plugin")
		const tab = { id: "welcome", title: "Welcome", content: "# Welcome" }
		const options = { target: "right", newTab: true } as const

		workspace.openMarkdownTab(tab, options)

		expect(openMarkdownTab).toHaveBeenCalledWith("intro-plugin", tab, options)
	})

	it("forwards view opens to the host bridge with the plugin id", () => {
		registerPlugin(["workspace:tabs", "ui:views"])
		const workspace = createWorkspaceAPI("intro-plugin")
		const options = { target: "right" } as const

		workspace.openView("browser", options)

		expect(openView).toHaveBeenCalledWith("intro-plugin", "browser", options)
	})

	it("requires the workspace capability before opening Markdown tabs", () => {
		registerPlugin(["ui:views"])
		const workspace = createWorkspaceAPI("intro-plugin")

		expect(() => workspace.openMarkdownTab({ title: "Welcome", content: "# Welcome" })).toThrow(
			'Plugin "intro-plugin" requires the workspace:tabs capability',
		)
		expect(openMarkdownTab).not.toHaveBeenCalled()
	})

	it("requires the views capability before opening declarative Markdown tabs", () => {
		registerPlugin(["workspace:tabs"])
		const workspace = createWorkspaceAPI("intro-plugin")

		expect(() => workspace.openMarkdownTab({ title: "Welcome", content: "# Welcome" })).toThrow(
			'Plugin "intro-plugin" requires the ui:views capability',
		)
		expect(openMarkdownTab).not.toHaveBeenCalled()
	})
})
