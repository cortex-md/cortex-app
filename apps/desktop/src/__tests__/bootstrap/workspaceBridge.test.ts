import { useWorkspaceStore } from "@cortex/core"
import { beforeEach, describe, expect, it } from "vitest"
import { openPluginMarkdownTab } from "../../bootstrap/workspaceBridge"
import { PLUGIN_MARKDOWN_NOTE_VIEW_ID } from "../../features/plugins/pluginMarkdownNote"

function getOpenTabs() {
	return Object.values(useWorkspaceStore.getState().panes).flatMap((pane) => pane.tabs)
}

describe("workspaceBridge", () => {
	beforeEach(() => {
		useWorkspaceStore.getState().reset()
	})

	it("opens plugin Markdown tabs as ephemeral core views", () => {
		openPluginMarkdownTab("intro-plugin", {
			id: "welcome",
			title: "Welcome",
			content: "# Welcome",
		})

		expect(getOpenTabs()[0]).toMatchObject({
			tabType: "view",
			viewId: PLUGIN_MARKDOWN_NOTE_VIEW_ID,
			title: "Welcome",
			isEphemeral: true,
			viewState: {
				pluginId: "intro-plugin",
				id: "welcome",
				title: "Welcome",
				content: "# Welcome",
			},
		})
	})

	it("updates an existing plugin Markdown tab by plugin id and tab id", () => {
		openPluginMarkdownTab("intro-plugin", {
			id: "welcome",
			title: "Welcome",
			content: "# Welcome",
		})
		const firstTabId = getOpenTabs()[0].id

		openPluginMarkdownTab("intro-plugin", {
			id: "welcome",
			title: "Updated welcome",
			content: "# Updated",
		})

		expect(getOpenTabs()).toHaveLength(1)
		expect(getOpenTabs()[0]).toMatchObject({
			id: firstTabId,
			title: "Updated welcome",
			viewState: {
				pluginId: "intro-plugin",
				id: "welcome",
				title: "Updated welcome",
				content: "# Updated",
			},
		})
	})

	it("opens a new tab when no plugin Markdown tab id is provided", () => {
		openPluginMarkdownTab("intro-plugin", { title: "First", content: "# First" })
		openPluginMarkdownTab("intro-plugin", { title: "Second", content: "# Second" })

		expect(getOpenTabs()).toHaveLength(2)
		expect(getOpenTabs().map((tab) => tab.title)).toEqual(["First", "Second"])
	})

	it("opens a duplicate tab when newTab is requested for an identified Markdown tab", () => {
		openPluginMarkdownTab("intro-plugin", {
			id: "welcome",
			title: "Welcome",
			content: "# Welcome",
		})
		openPluginMarkdownTab(
			"intro-plugin",
			{
				id: "welcome",
				title: "Welcome again",
				content: "# Welcome again",
			},
			{ newTab: true },
		)

		expect(getOpenTabs()).toHaveLength(2)
		expect(getOpenTabs().map((tab) => tab.title)).toEqual(["Welcome", "Welcome again"])
	})
})
