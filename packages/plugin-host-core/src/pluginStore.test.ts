import type { PluginCapability } from "@cortex.md/api"
import { afterEach, describe, expect, it } from "vitest"
import { createPluginAPI } from "./PluginAPIFactory"
import { pluginStore } from "./pluginStore"

function registerPlugin(pluginId: string, capabilities: PluginCapability[]): void {
	pluginStore.getState().registerPlugin({
		id: pluginId,
		name: pluginId,
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Test plugin",
		icon: "plug",
		main: "index.js",
		capabilities,
	})
}

describe("pluginStore ownership", () => {
	afterEach(() => {
		pluginStore.getState().reset()
	})

	it("keeps plugin-local registration ids from colliding", () => {
		registerPlugin("alpha", ["ui:views", "ui:sidebar", "settings"])
		registerPlugin("beta", ["ui:views", "ui:sidebar", "settings"])

		const alpha = createPluginAPI("alpha", () => null)
		const beta = createPluginAPI("beta", () => null)

		alpha.ui.registerView({
			id: "browser",
			label: "Alpha Browser",
			icon: "folder",
			location: "sidebar-left",
			render: () => ({ type: "text", value: "Alpha" }),
		})
		beta.ui.registerView({
			id: "browser",
			label: "Beta Browser",
			icon: "folder",
			location: "sidebar-left",
			render: () => ({ type: "text", value: "Beta" }),
		})
		alpha.ui.registerSidebarItem({
			id: "browser",
			label: "Alpha",
			icon: "folder",
			viewId: "browser",
		})
		beta.ui.registerSidebarItem({
			id: "browser",
			label: "Beta",
			icon: "folder",
			viewId: "browser",
		})
		alpha.ui.registerSettingsTab({
			id: "general",
			label: "Alpha",
			icon: "settings",
			settings: [],
		})
		beta.ui.registerSettingsTab({
			id: "general",
			label: "Beta",
			icon: "settings",
			settings: [],
		})

		const state = pluginStore.getState()
		expect(state.views.map((view) => view.registrationKey).sort()).toEqual([
			"alpha:browser",
			"beta:browser",
		])
		expect(state.sidebarItems.map((item) => item.registrationKey).sort()).toEqual([
			"alpha:browser",
			"beta:browser",
		])
		expect(state.settingsTabs.map((tab) => tab.registrationKey).sort()).toEqual([
			"alpha:general",
			"beta:general",
		])
	})

	it("limits modal close operations to the owning plugin", () => {
		registerPlugin("alpha", ["ui:views", "ui:modals"])
		registerPlugin("beta", ["ui:views", "ui:modals"])

		const alpha = createPluginAPI("alpha", () => null)
		const beta = createPluginAPI("beta", () => null)
		alpha.ui.registerView({
			id: "confirm",
			label: "Confirm",
			icon: "check",
			location: "modal",
			render: () => ({ type: "text", value: "Alpha" }),
		})

		const modalId = alpha.ui.openModal("confirm")
		expect(modalId).toBe("alpha:modal-0")
		if (!modalId) throw new Error("Expected modal to open")
		expect(pluginStore.getState().modalInstances).toHaveLength(1)

		beta.ui.closeModal(modalId)
		expect(pluginStore.getState().modalInstances).toHaveLength(1)

		alpha.ui.closeModal(modalId)
		expect(pluginStore.getState().modalInstances).toHaveLength(0)
	})
})
