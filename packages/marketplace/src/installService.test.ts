import type { FileEntry } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { installPlugin, installTheme, uninstallPlugin } from "./installService"
import type { GitHubRelease, GitHubReleaseAsset, RegistryEntry } from "./types"

const testState = vi.hoisted(() => ({
	files: new Map<string, string>(),
	dirs: new Set<string>(),
	downloads: new Map<string, string>(),
	archiveFiles: new Map<string, string>(),
	release: null as GitHubRelease | null,
	pluginState: {
		plugins: {} as Record<string, unknown>,
		unregisterPlugin: vi.fn(),
	},
	disablePlugin: vi.fn(),
	unregisterCommunityPlugin: vi.fn(),
	platform: null as unknown,
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => testState.platform,
}))

vi.mock("@cortex/plugin-host-core", () => ({
	disablePlugin: testState.disablePlugin,
	getCommunityPluginLoadError: vi.fn(() => null),
	pluginStore: {
		getState: () => testState.pluginState,
	},
	unregisterCommunityPlugin: testState.unregisterCommunityPlugin,
}))

vi.mock("@cortex/theme", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@cortex/theme")>()
	return {
		...actual,
		getThemeManager: () => ({
			unregisterTheme: vi.fn(),
		}),
	}
})

vi.mock("./registryService", () => ({
	fetchLatestRelease: vi.fn(async () => testState.release),
}))

const pluginsDir = "/vault/.cortex/plugins"
const themesDir = "/vault/.cortex/themes"
const entry: RegistryEntry = {
	id: "test-plugin",
	name: "Test Plugin",
	author: "Tester",
	description: "A plugin",
	coverImageUrl: "",
	repo: "owner/test-plugin",
}
const themeEntry: RegistryEntry = {
	id: "test-theme",
	name: "Test Theme",
	author: "Tester",
	description: "A theme",
	coverImageUrl: "",
	repo: "owner/test-theme",
}

function createManifest(partial: Record<string, unknown> = {}) {
	return JSON.stringify({
		id: "test-plugin",
		name: "Test Plugin",
		version: "1.0.0",
		minAppVersion: "0.1.0",
		author: "Tester",
		description: "A plugin",
		icon: "package",
		main: "main.js",
		...partial,
	})
}

function createThemeManifest(partial: Record<string, unknown> = {}) {
	return JSON.stringify({
		id: "test-theme",
		name: "test-theme",
		displayName: "Test Theme",
		author: "Tester",
		version: "1.0.0",
		colorschemes: {
			dark: "./theme-dark.css",
			light: "./theme-light.css",
		},
		...partial,
	})
}

function createThemeStylesheet(colorScheme: "light" | "dark") {
	return `@media (prefers-contrast: more) { body { color-scheme: ${colorScheme}; } }`
}

function createAsset(name: string): GitHubReleaseAsset {
	return {
		name,
		browser_download_url: `${name}-url`,
	}
}

function createRelease(assets: GitHubReleaseAsset[]): GitHubRelease {
	return {
		tag_name: "v1.0.0",
		published_at: "2026-01-01T00:00:00Z",
		assets,
		zipball_url: "zip-url",
	}
}

function normalizePath(path: string) {
	return path.replace(/\/+$/g, "") || "/"
}

function parentPath(path: string) {
	const normalized = normalizePath(path)
	const index = normalized.lastIndexOf("/")
	return index <= 0 ? "/" : normalized.slice(0, index)
}

function ensureDir(path: string) {
	const normalized = normalizePath(path)
	if (normalized === "/") {
		testState.dirs.add("/")
		return
	}
	ensureDir(parentPath(normalized))
	testState.dirs.add(normalized)
}

function createPlatform() {
	return {
		fs: {
			readFile: vi.fn(async (path: string) => {
				const content = testState.files.get(normalizePath(path))
				if (content === undefined) throw new Error(`Missing file: ${path}`)
				return content
			}),
			writeFile: vi.fn(async (path: string, content: string) => {
				const normalized = normalizePath(path)
				ensureDir(parentPath(normalized))
				testState.files.set(normalized, content)
			}),
			writeBinaryFile: vi.fn(),
			deleteFile: vi.fn(async (path: string) => {
				const normalized = normalizePath(path)
				let found = testState.files.delete(normalized) || testState.dirs.delete(normalized)
				for (const file of Array.from(testState.files.keys())) {
					if (file.startsWith(`${normalized}/`)) {
						testState.files.delete(file)
						found = true
					}
				}
				for (const dir of Array.from(testState.dirs.keys())) {
					if (dir.startsWith(`${normalized}/`)) {
						testState.dirs.delete(dir)
						found = true
					}
				}
				if (!found) throw new Error(`Missing path: ${path}`)
			}),
			renameFile: vi.fn(async (oldPath: string, newPath: string) => {
				const oldNormalized = normalizePath(oldPath)
				const newNormalized = normalizePath(newPath)
				if (testState.files.has(oldNormalized)) {
					const content = testState.files.get(oldNormalized)!
					testState.files.delete(oldNormalized)
					ensureDir(parentPath(newNormalized))
					testState.files.set(newNormalized, content)
					return
				}
				if (!testState.dirs.has(oldNormalized)) throw new Error(`Missing path: ${oldPath}`)
				ensureDir(parentPath(newNormalized))
				for (const dir of Array.from(testState.dirs.keys())) {
					if (dir === oldNormalized || dir.startsWith(`${oldNormalized}/`)) {
						testState.dirs.delete(dir)
						testState.dirs.add(dir.replace(oldNormalized, newNormalized))
					}
				}
				for (const file of Array.from(testState.files.keys())) {
					if (file.startsWith(`${oldNormalized}/`)) {
						const content = testState.files.get(file)!
						testState.files.delete(file)
						testState.files.set(file.replace(oldNormalized, newNormalized), content)
					}
				}
			}),
			createDir: vi.fn(async (path: string) => ensureDir(path)),
			listDir: vi.fn(async (path: string): Promise<FileEntry[]> => {
				const normalized = normalizePath(path)
				if (!testState.dirs.has(normalized)) throw new Error(`Missing dir: ${path}`)
				const entries = new Map<string, FileEntry>()
				for (const dir of testState.dirs.keys()) {
					if (dir === normalized || !dir.startsWith(`${normalized}/`)) continue
					const name = dir.slice(normalized.length + 1).split("/")[0]
					const childPath = `${normalized}/${name}`
					entries.set(childPath, { path: childPath, name, isDir: true })
				}
				for (const file of testState.files.keys()) {
					if (!file.startsWith(`${normalized}/`)) continue
					const name = file.slice(normalized.length + 1).split("/")[0]
					const childPath = `${normalized}/${name}`
					if (!entries.has(childPath)) {
						entries.set(childPath, { path: childPath, name, isDir: false })
					}
				}
				return Array.from(entries.values())
			}),
			hashFile: vi.fn(),
			startWatching: vi.fn(),
			downloadFile: vi.fn(async (url: string, destPath: string) => {
				const content = testState.downloads.get(url)
				if (content === undefined) throw new Error(`Missing download: ${url}`)
				const platform = testState.platform as ReturnType<typeof createPlatform>
				await platform.fs.writeFile(destPath, content)
			}),
			downloadAndExtract: vi.fn(async (_url: string, destDir: string) => {
				for (const [path, content] of testState.archiveFiles) {
					const platform = testState.platform as ReturnType<typeof createPlatform>
					await platform.fs.writeFile(`${destDir}/${path}`, content)
				}
			}),
		},
	}
}

function registerDownloads(files: Record<string, string>) {
	for (const [name, content] of Object.entries(files)) {
		testState.downloads.set(`${name}-url`, content)
	}
}

function createReloadPluginHost() {
	return vi.fn(async () => {
		const manifestPath = `${pluginsDir}/test-plugin/manifest.json`
		const manifest = testState.files.get(manifestPath)
		if (!manifest) return
		testState.pluginState.plugins["test-plugin"] = {
			manifest: JSON.parse(manifest),
			status: "loaded",
		}
	})
}

function hasInstalledPath(path: string) {
	return testState.files.has(`${pluginsDir}/test-plugin/${path}`)
}

function hasInstalledThemePath(path: string) {
	return testState.files.has(`${themesDir}/test-theme/${path}`)
}

function hasPartialInstallWorkspace() {
	return [...testState.files.keys(), ...testState.dirs.keys()].some((path) =>
		path.includes(".test-plugin-install-"),
	)
}

beforeEach(() => {
	vi.clearAllMocks()
	testState.files.clear()
	testState.dirs.clear()
	testState.downloads.clear()
	testState.archiveFiles.clear()
	testState.pluginState.plugins = {}
	testState.pluginState.unregisterPlugin.mockImplementation((id: string) => {
		delete testState.pluginState.plugins[id]
	})
	testState.unregisterCommunityPlugin.mockImplementation((id: string) => {
		delete testState.pluginState.plugins[id]
	})
	testState.disablePlugin.mockResolvedValue(undefined)
	testState.platform = createPlatform()
	testState.release = createRelease([
		createAsset("manifest.json"),
		createAsset("main.js"),
		createAsset("styles.css"),
	])
	ensureDir(pluginsDir)
	ensureDir(themesDir)
	registerDownloads({
		"manifest.json": createManifest(),
		"main.js": "module.exports = class TestPlugin {}",
		"styles.css": ".test-plugin {}",
	})
})

describe("installPlugin", () => {
	it("downloads release assets, promotes the plugin, and reloads the plugin host", async () => {
		const reloadPluginHost = createReloadPluginHost()

		await installPlugin(entry, pluginsDir, reloadPluginHost)

		expect(hasInstalledPath("manifest.json")).toBe(true)
		expect(hasInstalledPath("main.js")).toBe(true)
		expect(hasInstalledPath("styles.css")).toBe(true)
		expect(reloadPluginHost).toHaveBeenCalledWith(pluginsDir)
		expect(testState.pluginState.plugins["test-plugin"]).toBeDefined()
		expect(hasPartialInstallWorkspace()).toBe(false)
	})

	it("installs release assets without optional styles.css", async () => {
		testState.release = createRelease([createAsset("manifest.json"), createAsset("main.js")])
		testState.downloads.delete("styles.css-url")
		const reloadPluginHost = createReloadPluginHost()

		await installPlugin(entry, pluginsDir, reloadPluginHost)

		expect(hasInstalledPath("manifest.json")).toBe(true)
		expect(hasInstalledPath("main.js")).toBe(true)
		expect(hasInstalledPath("styles.css")).toBe(false)
		expect(testState.pluginState.plugins["test-plugin"]).toBeDefined()
	})

	it("falls back to the source zipball when required release assets are missing", async () => {
		testState.release = createRelease([])
		testState.archiveFiles.set("package/manifest.json", createManifest())
		testState.archiveFiles.set("package/main.js", "module.exports = class TestPlugin {}")
		testState.archiveFiles.set("package/styles.css", ".test-plugin {}")
		const reloadPluginHost = createReloadPluginHost()

		await installPlugin(entry, pluginsDir, reloadPluginHost)

		expect(hasInstalledPath("manifest.json")).toBe(true)
		expect(hasInstalledPath("main.js")).toBe(true)
		expect(hasInstalledPath("styles.css")).toBe(true)
		expect(testState.pluginState.plugins["test-plugin"]).toBeDefined()
	})

	it("fails when manifest id does not match the registry entry", async () => {
		registerDownloads({
			"manifest.json": createManifest({ id: "other-plugin" }),
			"main.js": "module.exports = class TestPlugin {}",
		})

		await expect(installPlugin(entry, pluginsDir, createReloadPluginHost())).rejects.toThrow(
			'Release manifest id must be "test-plugin"',
		)

		expect(hasInstalledPath("manifest.json")).toBe(false)
		expect(hasPartialInstallWorkspace()).toBe(false)
	})

	it("fails when manifest main is not a safe relative path", async () => {
		registerDownloads({
			"manifest.json": createManifest({ main: "../main.js" }),
			"main.js": "module.exports = class TestPlugin {}",
		})

		await expect(installPlugin(entry, pluginsDir, createReloadPluginHost())).rejects.toThrow(
			"Invalid plugin main path",
		)

		expect(hasInstalledPath("manifest.json")).toBe(false)
		expect(hasPartialInstallWorkspace()).toBe(false)
	})

	it("cleans the promoted plugin when discovery does not register it", async () => {
		const reloadPluginHost = vi.fn(async () => {})

		await expect(installPlugin(entry, pluginsDir, reloadPluginHost)).rejects.toThrow(
			"could not be loaded",
		)

		expect(hasInstalledPath("manifest.json")).toBe(false)
		expect(testState.pluginState.plugins["test-plugin"]).toBeUndefined()
	})

	it("restores the previous plugin when reload fails after promotion", async () => {
		ensureDir(`${pluginsDir}/test-plugin`)
		testState.files.set(
			`${pluginsDir}/test-plugin/manifest.json`,
			createManifest({ version: "1.0.0" }),
		)
		testState.files.set(`${pluginsDir}/test-plugin/main.js`, "module.exports = class OldPlugin {}")
		registerDownloads({
			"manifest.json": createManifest({ version: "2.0.0" }),
			"main.js": "module.exports = class NewPlugin {}",
		})
		const reloadPluginHost = vi.fn(async () => {
			throw new Error("reload failed")
		})

		await expect(installPlugin(entry, pluginsDir, reloadPluginHost)).rejects.toThrow(
			"reload failed",
		)

		expect(testState.files.get(`${pluginsDir}/test-plugin/manifest.json`)).toContain('"1.0.0"')
		expect(testState.files.get(`${pluginsDir}/test-plugin/main.js`)).toContain("OldPlugin")
		expect(testState.unregisterCommunityPlugin).not.toHaveBeenCalledWith("test-plugin")
		expect(hasPartialInstallWorkspace()).toBe(false)
		expect(reloadPluginHost).toHaveBeenCalledTimes(2)
	})

	it("disables and unregisters installed plugins during uninstall", async () => {
		ensureDir(`${pluginsDir}/test-plugin`)
		testState.files.set(`${pluginsDir}/test-plugin/manifest.json`, createManifest())
		testState.pluginState.plugins["test-plugin"] = {
			manifest: JSON.parse(createManifest()),
			status: "enabled",
		}

		await uninstallPlugin("test-plugin", pluginsDir)

		expect(testState.disablePlugin).toHaveBeenCalledWith("test-plugin")
		expect(
			(testState.platform as ReturnType<typeof createPlatform>).fs.deleteFile,
		).toHaveBeenCalledWith(`${pluginsDir}/test-plugin`)
		expect(testState.unregisterCommunityPlugin).toHaveBeenCalledWith("test-plugin")
		expect(testState.pluginState.plugins["test-plugin"]).toBeUndefined()
	})
})

describe("installTheme", () => {
	it("downloads colorscheme assets when manifest paths start with dot slash", async () => {
		testState.release = createRelease([
			createAsset("manifest.json"),
			createAsset("theme-dark.css"),
			createAsset("theme-light.css"),
		])
		registerDownloads({
			"manifest.json": createThemeManifest(),
			"theme-dark.css": createThemeStylesheet("dark"),
			"theme-light.css": createThemeStylesheet("light"),
		})
		const reloadThemes = vi.fn(async () => {})

		await installTheme(themeEntry, themesDir, reloadThemes)

		expect(hasInstalledThemePath("manifest.json")).toBe(true)
		expect(hasInstalledThemePath("theme-dark.css")).toBe(true)
		expect(hasInstalledThemePath("theme-light.css")).toBe(true)
		expect(reloadThemes).toHaveBeenCalledWith(themesDir)
	})

	it("rejects missing colorscheme assets without leaving staging files", async () => {
		testState.release = createRelease([createAsset("manifest.json"), createAsset("theme-dark.css")])
		registerDownloads({
			"manifest.json": createThemeManifest(),
			"theme-dark.css": createThemeStylesheet("dark"),
		})

		await expect(installTheme(themeEntry, themesDir, vi.fn())).rejects.toThrow(
			"missing colorscheme asset: light.css",
		)

		expect(hasInstalledThemePath("manifest.json")).toBe(false)
		expect(
			[...testState.files.keys(), ...testState.dirs.keys()].some((path) =>
				path.includes(".test-theme-install-"),
			),
		).toBe(false)
	})

	it("restores the previous theme when reload fails after promotion", async () => {
		testState.release = createRelease([
			createAsset("manifest.json"),
			createAsset("theme-dark.css"),
			createAsset("theme-light.css"),
		])
		registerDownloads({
			"manifest.json": createThemeManifest({ version: "2.0.0" }),
			"theme-dark.css": createThemeStylesheet("dark"),
			"theme-light.css": createThemeStylesheet("light"),
		})
		ensureDir(`${themesDir}/test-theme`)
		testState.files.set(
			`${themesDir}/test-theme/manifest.json`,
			createThemeManifest({ version: "1.0.0" }),
		)
		const reloadThemes = vi.fn(async () => {
			throw new Error("reload failed")
		})

		await expect(installTheme(themeEntry, themesDir, reloadThemes)).rejects.toThrow("reload failed")

		expect(testState.files.get(`${themesDir}/test-theme/manifest.json`)).toContain('"1.0.0"')
		expect(
			[...testState.files.keys(), ...testState.dirs.keys()].some((path) =>
				path.includes(".test-theme-install-"),
			),
		).toBe(false)
	})
})
