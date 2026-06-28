import { CortexPlugin } from "@cortex.md/api"
import { describe, expect, it, vi } from "vitest"

class TestPlugin extends CortexPlugin {
	onload(): void {}
}

describe("CortexPlugin helpers", () => {
	it("disposes settings tab listeners with the returned tab disposable", () => {
		const tabDispose = vi.fn()
		const listenerDispose = vi.fn()
		const plugin = new TestPlugin()
		plugin.manifest = {
			id: "settings-plugin",
			name: "Settings Plugin",
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Cortex",
			description: "Test plugin",
			icon: "plug",
			main: "index.js",
			capabilities: ["settings"],
		}
		plugin.api = {
			ui: {
				registerSettingsTab: vi.fn(() => ({ dispose: tabDispose })),
			},
			settings: {
				onChange: vi.fn(() => ({ dispose: listenerDispose })),
			},
		} as never

		const disposable = plugin.registerSettingsTab({
			id: "general",
			label: "General",
			icon: "settings",
			settings: [
				{
					key: "enabled",
					label: "Enabled",
					type: "boolean",
					default: true,
					onChange: vi.fn(),
				},
			],
		})

		disposable.dispose()
		disposable.dispose()
		plugin._disposeAll()

		expect(tabDispose).toHaveBeenCalledTimes(1)
		expect(listenerDispose).toHaveBeenCalledTimes(1)
	})
})
