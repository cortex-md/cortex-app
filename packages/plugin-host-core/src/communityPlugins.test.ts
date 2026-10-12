import { definePlugin } from "@cortex.md/api"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PluginHostServices } from "./pluginContext"
import { createPluginHost, type PluginHost } from "./pluginHost"
import { resetPluginStore, usePluginStore } from "./pluginStore"

const testState = vi.hoisted(() => ({
	files: new Map<string, string>(),
	dirs: new Map<string, { path: string; name: string; isDir: boolean }[]>(),
	styles: new Map<string, string | null>(),
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
const loadEditorExternals = vi.fn(async () => ({
	"@codemirror/state": { marker: "state" },
	"@codemirror/view": { marker: "view" },
}))

type ReloadGlobals = typeof globalThis & { reloadEvents?: string[] }

function createHost(): PluginHost {
	return createPluginHost({
		getVaultPath: () => null,
		community: {
			loadEditorExternals,
			isAllowed: () => true,
			styles: {
				install: (pluginId: string, css: string | null) => testState.styles.set(pluginId, css),
				remove: (pluginId: string) => testState.styles.delete(pluginId),
			},
		},
	} as unknown as PluginHostServices)
}

function definitionSource(pluginId: string, body = "") {
	return [
		'const { definePlugin } = require("@cortex.md/api")',
		"module.exports = definePlugin({",
		`	manifest: { id: "${pluginId}", name: "${pluginId}", version: "0.1.0", minAppVersion: "0.1.0", author: "Tester", description: "Test", icon: "puzzle" },`,
		body,
		"})",
	].join("\n")
}

function recordEvent(event: string) {
	return `globalThis.reloadEvents = [...(globalThis.reloadEvents ?? []), "${event}"]`
}

function registerPluginFiles(pluginId: string, main: string, styles?: string) {
	const pluginDir = `${pluginsDir}/${pluginId}`
	testState.dirs.set(pluginsDir, [{ path: pluginDir, name: pluginId, isDir: true }])
	testState.files.set(
		`${pluginDir}/manifest.json`,
		JSON.stringify({ id: pluginId, main: "main.js" }),
	)
	testState.files.set(`${pluginDir}/main.js`, main)
	if (styles) testState.files.set(`${pluginDir}/styles.css`, styles)
}

let host: PluginHost

beforeEach(() => {
	resetPluginStore()
	testState.files.clear()
	testState.dirs.clear()
	testState.styles.clear()
	loadEditorExternals.mockClear()
	delete (globalThis as ReloadGlobals).reloadEvents
	host = createHost()
})

describe("community plugins", () => {
	it("loads CommonJS community bundles", async () => {
		registerPluginFiles("common-js-plugin", definitionSource("common-js-plugin"))

		await host.discoverCommunityPlugins(pluginsDir)

		expect(usePluginStore.getState().plugins["common-js-plugin"]?.community).toBe(true)
		expect(host.getCommunityPluginLoadError("common-js-plugin")).toBeNull()
	})

	it("loads self-contained ESM community bundles", async () => {
		registerPluginFiles(
			"esm-plugin",
			'export default { manifest: { id: "esm-plugin", name: "ESM", version: "0.1.0", minAppVersion: "0.1.0", author: "Tester", description: "Test", icon: "puzzle" } }',
		)

		await host.discoverCommunityPlugins(pluginsDir)

		expect(usePluginStore.getState().plugins["esm-plugin"]).toBeDefined()
		expect(host.getCommunityPluginLoadError("esm-plugin")).toBeNull()
	})

	it("does not load CodeMirror externals for bundles that do not import them", async () => {
		registerPluginFiles("plain-plugin", definitionSource("plain-plugin"))

		await host.discoverCommunityPlugins(pluginsDir)

		expect(loadEditorExternals).not.toHaveBeenCalled()
		expect(usePluginStore.getState().plugins["plain-plugin"]).toBeDefined()
	})

	it("loads CodeMirror externals for CommonJS bundles that require them", async () => {
		registerPluginFiles(
			"editor-extension-plugin",
			[
				'const state = require("@codemirror/state")',
				'const view = require("@codemirror/view")',
				'if (state.marker !== "state" || view.marker !== "view") throw new Error("missing externals")',
				definitionSource("editor-extension-plugin"),
			].join("\n"),
		)

		await host.discoverCommunityPlugins(pluginsDir)

		expect(loadEditorExternals).toHaveBeenCalledTimes(1)
		expect(host.getCommunityPluginLoadError("editor-extension-plugin")).toBeNull()
	})

	it("stores the loader error when a bundle does not export a plugin definition", async () => {
		registerPluginFiles("bad-plugin", "export const value = 1;")

		await host.discoverCommunityPlugins(pluginsDir)

		expect(usePluginStore.getState().plugins["bad-plugin"]).toBeUndefined()
		expect(host.getCommunityPluginLoadError("bad-plugin")).toContain(
			"Plugin bundle must export a definePlugin(...) object as default",
		)
	})

	it("stores the loader error when a plugin declares an unknown permission", async () => {
		registerPluginFiles(
			"unknown-permission-plugin",
			definitionSource("unknown-permission-plugin").replace(
				'icon: "puzzle" }',
				'icon: "puzzle", permissions: ["notifications", "native:everything"] }',
			),
		)

		await host.discoverCommunityPlugins(pluginsDir)

		expect(usePluginStore.getState().plugins["unknown-permission-plugin"]).toBeUndefined()
		expect(host.getCommunityPluginLoadError("unknown-permission-plugin")).toContain(
			'Unknown plugin permission "native:everything"',
		)
	})

	it("rejects bundled plugins with unknown permissions", () => {
		const definition = definePlugin({
			manifest: {
				id: "bad-bundled-plugin",
				name: "Bad Bundled Plugin",
				version: "0.1.0",
				minAppVersion: "0.1.0",
				author: "Tester",
				description: "Test plugin",
				icon: "puzzle",
				permissions: ["native:everything" as never],
			},
		})

		expect(() => host.registerBundledPlugins([definition])).toThrow(
			'Unknown plugin permission "native:everything"',
		)
	})

	it("reloads enabled community plugins from the latest bundle", async () => {
		registerPluginFiles(
			"reload-plugin",
			definitionSource(
				"reload-plugin",
				`activation: "startup", activate: () => { ${recordEvent("load-v1")}; return () => { ${recordEvent("unload-v1")} } },`,
			),
		)
		await host.discoverCommunityPlugins(pluginsDir)
		await host.enablePlugin("reload-plugin")

		testState.files.set(
			`${pluginsDir}/reload-plugin/main.js`,
			definitionSource(
				"reload-plugin",
				`activation: "startup", activate: () => { ${recordEvent("load-v2")} },`,
			),
		)
		await host.reloadCommunityPlugins(pluginsDir)

		expect((globalThis as ReloadGlobals).reloadEvents).toEqual(["load-v1", "unload-v1", "load-v2"])
		expect(usePluginStore.getState().plugins["reload-plugin"].status).toBe("enabled")
	})

	it("does not enable discovered community plugins during reload", async () => {
		registerPluginFiles(
			"disabled-plugin",
			definitionSource(
				"disabled-plugin",
				`activation: "startup", activate: () => { ${recordEvent("loaded")} },`,
			),
		)

		await host.discoverCommunityPlugins(pluginsDir)
		await host.reloadCommunityPlugins(pluginsDir)

		expect((globalThis as ReloadGlobals).reloadEvents).toBeUndefined()
		expect(usePluginStore.getState().plugins["disabled-plugin"].status).toBe("loaded")
	})

	it("scopes plugin styles to markdown surfaces for the enabled lifecycle", async () => {
		registerPluginFiles(
			"styled-plugin",
			definitionSource("styled-plugin", "contributes: { markdown: {} },"),
			".custom-callout { color: red }",
		)

		await host.discoverCommunityPlugins(pluginsDir)
		await host.enablePlugin("styled-plugin")

		expect(testState.styles.get("styled-plugin")).toContain(
			":where(.markdown-surface) .custom-callout",
		)

		await host.disableAllPlugins()

		expect(testState.styles.has("styled-plugin")).toBe(false)
	})

	it("rejects plugin styles without markdown contributions", async () => {
		registerPluginFiles(
			"unscoped-plugin",
			definitionSource("unscoped-plugin"),
			".custom-callout { color: red }",
		)

		await host.discoverCommunityPlugins(pluginsDir)

		expect(usePluginStore.getState().plugins["unscoped-plugin"]).toBeUndefined()
		expect(host.getCommunityPluginLoadError("unscoped-plugin")).toContain(
			"styles.css requires markdown contributions",
		)
	})

	it("replaces plugin styles during hot reload", async () => {
		registerPluginFiles(
			"style-reload-plugin",
			definitionSource("style-reload-plugin", "contributes: { markdown: {} },"),
			".custom-callout { color: red }",
		)

		await host.discoverCommunityPlugins(pluginsDir)
		await host.enablePlugin("style-reload-plugin")
		testState.files.set(
			`${pluginsDir}/style-reload-plugin/styles.css`,
			".custom-callout { color: blue }",
		)

		await host.reloadCommunityPlugins(pluginsDir)

		expect(testState.styles.get("style-reload-plugin")).toContain("blue")
	})
})
