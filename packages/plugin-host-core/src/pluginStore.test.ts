import { afterEach, describe, expect, it } from "vitest"
import {
	closeModal,
	openModal,
	registerContributions,
	resetPluginStore,
	usePluginStore,
} from "./pluginStore"

const textView = {
	icon: "folder",
	initialState: {},
	render: () => ({ type: "text" as const, value: "View" }),
}

describe("pluginStore ownership", () => {
	afterEach(() => {
		resetPluginStore()
	})

	it("keeps plugin-local registration ids from colliding", () => {
		for (const owner of ["alpha", "beta"]) {
			registerContributions(owner, {
				views: [{ ...textView, id: "browser", label: owner, location: "sidebar-left" }],
				sidebarItems: [
					{ id: "browser", label: owner, icon: "folder", viewKey: `${owner}:browser` },
				],
				settingsPages: [
					{
						id: "settings",
						label: owner,
						title: owner,
						description: "",
						group: "Plugin settings",
						icon: "settings",
					},
				],
			})
		}
		registerContributions("core", {
			views: [{ ...textView, id: "browser", label: "Core", location: "tab" }],
		})

		const state = usePluginStore.getState()
		expect(state.views.map((view) => view.key).sort()).toEqual([
			"alpha:browser",
			"beta:browser",
			"browser",
		])
		expect(state.sidebarItems.map((item) => item.key).sort()).toEqual([
			"alpha:browser",
			"beta:browser",
		])
		expect(state.settingsPages.map((page) => page.key).sort()).toEqual([
			"alpha:settings",
			"beta:settings",
		])
	})

	it("limits modal close operations to the owning plugin", () => {
		registerContributions("alpha", {
			views: [{ ...textView, id: "confirm", label: "Confirm", location: "modal" }],
		})

		const modalId = openModal("alpha", "alpha:confirm")
		expect(modalId).toBe("alpha:modal-0")
		if (!modalId) throw new Error("Expected modal to open")
		expect(usePluginStore.getState().modalInstances).toHaveLength(1)

		closeModal(modalId, "beta")
		expect(usePluginStore.getState().modalInstances).toHaveLength(1)

		closeModal(modalId, "alpha")
		expect(usePluginStore.getState().modalInstances).toHaveLength(0)
	})
})
