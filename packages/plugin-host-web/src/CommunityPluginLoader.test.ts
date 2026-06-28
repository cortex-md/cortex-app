// @vitest-environment jsdom

import type { FileEntry } from "@cortex/platform"
import {
	disableAllPlugins,
	enablePlugin,
	getCommunityPluginLoadError,
	pluginStore,
	registerBundledPlugin,
} from "@cortex/plugin-host-core"
import type { PluginCapability } from "@cortex.md/api"
import { CortexPlugin } from "@cortex.md/api"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	discoverCommunityPlugins,
	installWebPluginMarkdownStyleHost,
	reloadCommunityPlugins,
	setCodeMirrorExternalLoader,
} from "./index"

const testState = vi.hoisted(() => ({
	files: new Map<string, string>(),
	dirs: new Map<string, FileEntry[]>(),
	platform: {
		fs: {
			listDir: vi.fn(async (path: string) => {
				const entries = testState.dirs.get(path)
				if (!entries) throw new Error(`Missing dir: ${path}`)
				return entries
			}),
			readFile: vi.fn(async (path: string) => {
				const content = testState.files.get(path)
				if (content === undefined) throw new Error(`Missing file: ${path}`)
				return content
			}),
		},
	},
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => testState.platform,
}))

const pluginsDir = "/vault/.cortex/plugins"

class BadBundledPlugin extends CortexPlugin {
	onload() {}
}

interface PluginFilesOptions {
	capabilities?: PluginCapability[]
	styles?: string
}

function registerPluginFiles(pluginId: string, main: string, options: PluginFilesOptions = {}) {
	const pluginDir = `${pluginsDir}/${pluginId}`
	testState.dirs.set(pluginsDir, [
		{
			path: pluginDir,
			name: pluginId,
			isDir: true,
		},
	])
	testState.files.set(
		`${pluginDir}/manifest.json`,
		JSON.stringify({
			id: pluginId,
			name: pluginId,
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Tester",
			description: "Test plugin",
			icon: "puzzle",
			main: "main.js",
			capabilities: options.capabilities,
		}),
	)
	testState.files.set(`${pluginDir}/main.js`, main)
	if (options.styles) testState.files.set(`${pluginDir}/styles.css`, options.styles)
}

beforeEach(async () => {
	installWebPluginMarkdownStyleHost()
	await disableAllPlugins()
	testState.files.clear()
	testState.dirs.clear()
	testState.platform.fs.listDir.mockClear()
	testState.platform.fs.readFile.mockClear()
	setCodeMirrorExternalLoader(null)
	pluginStore.getState().reset()
	delete (globalThis as typeof globalThis & { reloadEvents?: string[] }).reloadEvents
})

describe("discoverCommunityPlugins", () => {
	it("loads CommonJS community bundles", async () => {
		registerPluginFiles("common-js-plugin", "module.exports = class CommonJSPlugin {}")

		await discoverCommunityPlugins(pluginsDir)

		expect(pluginStore.getState().plugins["common-js-plugin"]).toBeDefined()
		expect(getCommunityPluginLoadError("common-js-plugin")).toBeNull()
	})

	it("loads self-contained ESM community bundles", async () => {
		registerPluginFiles(
			"esm-plugin",
			["class ESMPlugin {}", "export { ESMPlugin as default };"].join("\n"),
		)

		await discoverCommunityPlugins(pluginsDir)

		expect(pluginStore.getState().plugins["esm-plugin"]).toBeDefined()
		expect(getCommunityPluginLoadError("esm-plugin")).toBeNull()
	})

	it("does not load CodeMirror externals for plugins without editor extensions", async () => {
		const loadExternals = vi.fn(async () => ({
			"@codemirror/state": {},
			"@codemirror/view": {},
		}))
		setCodeMirrorExternalLoader(loadExternals)
		registerPluginFiles("plain-plugin", "module.exports = class PlainPlugin {}")

		await discoverCommunityPlugins(pluginsDir)

		expect(loadExternals).not.toHaveBeenCalled()
		expect(pluginStore.getState().plugins["plain-plugin"]).toBeDefined()
	})

	it("loads CodeMirror externals for CommonJS plugins with editor extensions", async () => {
		const loadExternals = vi.fn(async () => ({
			"@codemirror/state": { marker: "state" },
			"@codemirror/view": { marker: "view" },
		}))
		setCodeMirrorExternalLoader(loadExternals)
		registerPluginFiles(
			"editor-extension-plugin",
			[
				'const state = require("@codemirror/state")',
				'const view = require("@codemirror/view")',
				'if (state.marker !== "state" || view.marker !== "view") throw new Error("missing externals")',
				"module.exports = class EditorExtensionPlugin {}",
			].join("\n"),
			{ capabilities: ["editor:extensions"] },
		)

		await discoverCommunityPlugins(pluginsDir)

		expect(loadExternals).toHaveBeenCalledTimes(1)
		expect(pluginStore.getState().plugins["editor-extension-plugin"]).toBeDefined()
		expect(getCommunityPluginLoadError("editor-extension-plugin")).toBeNull()
	})

	it("stores the loader error when a bundle cannot export a plugin class", async () => {
		registerPluginFiles("bad-plugin", "export const value = 1;")

		await discoverCommunityPlugins(pluginsDir)

		expect(pluginStore.getState().plugins["bad-plugin"]).toBeUndefined()
		expect(getCommunityPluginLoadError("bad-plugin")).toContain(
			"Plugin bundle must export a default plugin class",
		)
	})

	it("stores the loader error when a manifest declares an unknown capability", async () => {
		registerPluginFiles("unknown-capability-plugin", "module.exports = class TestPlugin {}")
		testState.files.set(
			`${pluginsDir}/unknown-capability-plugin/manifest.json`,
			JSON.stringify({
				id: "unknown-capability-plugin",
				name: "Unknown Capability Plugin",
				version: "0.1.0",
				minAppVersion: "0.1.0",
				author: "Tester",
				description: "Test plugin",
				icon: "puzzle",
				main: "main.js",
				capabilities: ["notifications", "native:everything"],
			}),
		)

		await discoverCommunityPlugins(pluginsDir)

		expect(pluginStore.getState().plugins["unknown-capability-plugin"]).toBeUndefined()
		expect(getCommunityPluginLoadError("unknown-capability-plugin")).toContain(
			'Unknown plugin capability "native:everything"',
		)
	})

	it("rejects bundled plugins with unknown capabilities", () => {
		expect(() =>
			registerBundledPlugin(
				{
					id: "bad-bundled-plugin",
					name: "Bad Bundled Plugin",
					version: "0.1.0",
					minAppVersion: "0.1.0",
					author: "Tester",
					description: "Test plugin",
					icon: "puzzle",
					main: "main.js",
					capabilities: ["native:everything" as never],
				},
				{ default: BadBundledPlugin },
			),
		).toThrow('Unknown plugin capability "native:everything"')
	})

	it("reloads enabled community plugins from the latest bundle", async () => {
		registerPluginFiles(
			"reload-plugin",
			[
				`const { CortexPlugin } = require("@cortex.md/api")`,
				`module.exports = class ReloadPlugin extends CortexPlugin {`,
				`	onload() { globalThis.reloadEvents = [...(globalThis.reloadEvents ?? []), "load-v1"] }`,
				`	onunload() { globalThis.reloadEvents = [...(globalThis.reloadEvents ?? []), "unload-v1"] }`,
				`}`,
			].join("\n"),
		)

		await discoverCommunityPlugins(pluginsDir)
		await enablePlugin("reload-plugin", () => null)

		testState.files.set(
			`${pluginsDir}/reload-plugin/main.js`,
			[
				`const { CortexPlugin } = require("@cortex.md/api")`,
				`module.exports = class ReloadPlugin extends CortexPlugin {`,
				`	onload() { globalThis.reloadEvents = [...(globalThis.reloadEvents ?? []), "load-v2"] }`,
				`}`,
			].join("\n"),
		)

		await reloadCommunityPlugins(pluginsDir, () => null)

		expect((globalThis as typeof globalThis & { reloadEvents?: string[] }).reloadEvents).toEqual([
			"load-v1",
			"unload-v1",
			"load-v2",
		])
		expect(pluginStore.getState().plugins["reload-plugin"].status).toBe("enabled")
	})

	it("does not enable discovered community plugins during reload", async () => {
		registerPluginFiles(
			"disabled-plugin",
			[
				`const { CortexPlugin } = require("@cortex.md/api")`,
				`module.exports = class DisabledPlugin extends CortexPlugin {`,
				`	onload() { globalThis.reloadEvents = [...(globalThis.reloadEvents ?? []), "loaded"] }`,
				`}`,
			].join("\n"),
		)

		await discoverCommunityPlugins(pluginsDir)
		await reloadCommunityPlugins(pluginsDir, () => null)

		expect(
			(globalThis as typeof globalThis & { reloadEvents?: string[] }).reloadEvents,
		).toBeUndefined()
		expect(pluginStore.getState().plugins["disabled-plugin"].status).toBe("loaded")
	})

	it("scopes plugin styles to markdown surfaces for the enabled lifecycle", async () => {
		registerPluginFiles(
			"styled-plugin",
			[
				'const { CortexPlugin } = require("@cortex.md/api")',
				"module.exports = class StyledPlugin extends CortexPlugin { onload() {} }",
			].join("\n"),
			{
				capabilities: ["markdown:extensions"],
				styles: ".custom-callout { color: red }",
			},
		)

		await discoverCommunityPlugins(pluginsDir)
		await enablePlugin("styled-plugin", () => null)

		const style = document.head.querySelector<HTMLStyleElement>(
			'style[data-cortex-plugin-style="styled-plugin"]',
		)
		expect(style?.textContent).toContain(":where(.markdown-surface) .custom-callout")

		await disableAllPlugins()

		expect(
			document.head.querySelector('style[data-cortex-plugin-style="styled-plugin"]'),
		).toBeNull()
	})

	it("rejects plugin styles without the markdown capability", async () => {
		registerPluginFiles("unscoped-plugin", "module.exports = class UnscopedPlugin {}", {
			styles: ".custom-callout { color: red }",
		})

		await discoverCommunityPlugins(pluginsDir)

		expect(pluginStore.getState().plugins["unscoped-plugin"]).toBeUndefined()
		expect(getCommunityPluginLoadError("unscoped-plugin")).toContain(
			'styles.css requires the "markdown:extensions" capability',
		)
	})

	it("replaces plugin styles during hot reload", async () => {
		registerPluginFiles(
			"style-reload-plugin",
			[
				'const { CortexPlugin } = require("@cortex.md/api")',
				"module.exports = class StyleReloadPlugin extends CortexPlugin { onload() {} }",
			].join("\n"),
			{
				capabilities: ["markdown:extensions"],
				styles: ".custom-callout { color: red }",
			},
		)

		await discoverCommunityPlugins(pluginsDir)
		await enablePlugin("style-reload-plugin", () => null)
		testState.files.set(
			`${pluginsDir}/style-reload-plugin/styles.css`,
			".custom-callout { color: blue }",
		)

		await reloadCommunityPlugins(pluginsDir, () => null)

		const styles = document.head.querySelectorAll(
			'style[data-cortex-plugin-style="style-reload-plugin"]',
		)
		expect(styles).toHaveLength(1)
		expect(styles[0]?.textContent).toContain("blue")
	})
})
