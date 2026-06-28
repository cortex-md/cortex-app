import { type FileEntry, getPlatform } from "@cortex/platform"
import {
	clearCommunityPluginRegistration,
	disablePlugin,
	enablePlugin,
	getCommunityPluginEntries,
	getEnabledCommunityPluginEntries,
	type PluginModule,
	pluginStore,
	registerCommunityPlugin,
	runPluginLifecycleInOrder,
	scopePluginMarkdownStyles,
	setCommunityPluginLoadError,
	validatePluginManifestCapabilities,
} from "@cortex/plugin-host-core"
import type { PluginManifest } from "@cortex.md/api"
import { CortexPlugin } from "@cortex.md/api"

interface CommunityPluginDiscovery {
	pluginId: string
	dirPath: string
	manifest?: PluginManifest
	module?: PluginModule
	styles?: string | null
	error?: string
}

const communityPluginExternals: Record<string, unknown> = {
	"@cortex.md/api": { CortexPlugin },
}

let codeMirrorExternalLoader: (() => Promise<Record<string, unknown>>) | null = null
let codeMirrorExternalLoad: Promise<void> | null = null
let codeMirrorExternalsLoaded = false
let communityPluginsDir = "~/.cortex/plugins"

export function setCommunityPluginExternal(moduleId: string, moduleExports: unknown): void {
	communityPluginExternals[moduleId] = moduleExports
}

export function setCodeMirrorExternalLoader(
	loader: (() => Promise<Record<string, unknown>>) | null,
): void {
	codeMirrorExternalLoader = loader
	codeMirrorExternalLoad = null
	codeMirrorExternalsLoaded = false
}

export function setCommunityPluginsDir(dir: string): void {
	communityPluginsDir = dir
}

export function getCommunityPluginsDir(): string {
	return communityPluginsDir
}

async function loadCodeMirrorPluginExternals(): Promise<void> {
	if (!codeMirrorExternalLoader) return
	if (codeMirrorExternalsLoaded) return
	if (!codeMirrorExternalLoad) {
		codeMirrorExternalLoad = codeMirrorExternalLoader()
			.then((externals) => {
				for (const [moduleId, moduleExports] of Object.entries(externals)) {
					setCommunityPluginExternal(moduleId, moduleExports)
				}
				codeMirrorExternalsLoaded = true
			})
			.finally(() => {
				codeMirrorExternalLoad = null
			})
	}
	await codeMirrorExternalLoad
}

export async function discoverCommunityPlugins(pluginsDir: string): Promise<void> {
	const fs = getPlatform().fs
	let entries: Awaited<ReturnType<typeof fs.listDir>>
	try {
		entries = await fs.listDir(pluginsDir)
	} catch {
		return
	}

	const pluginDirs = entries.filter((entry) => entry.isDir)
	const discoveredPluginIds = new Set<string>()
	const discoveredPlugins = await Promise.all(pluginDirs.map((dir) => discoverCommunityPlugin(dir)))
	for (const discoveredPlugin of discoveredPlugins) {
		discoveredPluginIds.add(discoveredPlugin.pluginId)
		clearCommunityPluginRegistration(discoveredPlugin.pluginId)

		if (discoveredPlugin.error || !discoveredPlugin.manifest || !discoveredPlugin.module) {
			setCommunityPluginLoadError(
				discoveredPlugin.pluginId,
				discoveredPlugin.error ?? "Plugin could not be loaded",
			)
			continue
		}

		registerCommunityPlugin(discoveredPlugin.manifest, discoveredPlugin.module, {
			dirPath: discoveredPlugin.dirPath,
			styles: discoveredPlugin.styles,
		})
	}

	const removedPluginIds = getCommunityPluginEntries().flatMap(({ pluginId, dirPath }) =>
		isPluginDirInside(dirPath, pluginsDir) && !discoveredPluginIds.has(pluginId) ? [pluginId] : [],
	)
	await runPluginLifecycleInOrder(removedPluginIds, async (pluginId) => {
		await disablePlugin(pluginId)
		clearCommunityPluginRegistration(pluginId)
	})
}

async function discoverCommunityPlugin(dir: FileEntry): Promise<CommunityPluginDiscovery> {
	const fs = getPlatform().fs
	let pluginId = dir.name
	try {
		const manifestContent = await fs.readFile(`${dir.path}/manifest.json`)
		const manifest = JSON.parse(manifestContent) as PluginManifest

		if (manifest.id) pluginId = manifest.id
		if (!manifest.id) {
			return { pluginId, dirPath: dir.path, error: "manifest.json is missing id" }
		}
		if (!manifest.main) {
			return { pluginId, dirPath: dir.path, error: "manifest.json is missing main" }
		}

		validatePluginManifestCapabilities(manifest)
		const mainPath = resolvePluginMainPath(dir.path, manifest.main)
		if (!mainPath) {
			return { pluginId, dirPath: dir.path, error: "manifest.main must be a safe relative path" }
		}

		const [styles, moduleCode] = await Promise.all([
			readCommunityPluginStyles(dir.path, manifest),
			fs.readFile(mainPath),
			manifest.capabilities?.includes("editor:extensions")
				? loadCodeMirrorPluginExternals()
				: Promise.resolve(),
		])
		return {
			pluginId,
			dirPath: dir.path,
			manifest,
			module: await loadCommunityModule(moduleCode, manifest.id),
			styles,
		}
	} catch (error) {
		return { pluginId, dirPath: dir.path, error: getErrorMessage(error) }
	}
}

async function readCommunityPluginStyles(
	pluginDir: string,
	manifest: PluginManifest,
): Promise<string | null> {
	let source: string
	try {
		source = await getPlatform().fs.readFile(`${pluginDir}/styles.css`)
	} catch {
		return null
	}
	if (!source.trim()) return null
	if (!manifest.capabilities?.includes("markdown:extensions")) {
		throw new Error('styles.css requires the "markdown:extensions" capability')
	}
	return scopePluginMarkdownStyles(source)
}

export async function reloadCommunityPlugins(
	pluginsDir: string,
	getVaultPath: () => string | null,
): Promise<void> {
	const enabledPluginIds = getEnabledCommunityPluginEntries().flatMap(({ pluginId, dirPath }) =>
		isPluginDirInside(dirPath, pluginsDir) ? [pluginId] : [],
	)

	// oxlint-disable-next-line react-doctor/async-parallel -- plugin reload phases must stay ordered
	await runPluginLifecycleInOrder(enabledPluginIds, disablePlugin)
	await discoverCommunityPlugins(pluginsDir)

	await runPluginLifecycleInOrder(enabledPluginIds, async (pluginId) => {
		try {
			if (!pluginStore.getState().plugins[pluginId]) return
			await enablePlugin(pluginId, getVaultPath)
		} catch (error) {
			reportPluginOperationError("reload", pluginId, error)
		}
	})
}

function reportPluginOperationError(operation: string, pluginId: string, error: unknown): void {
	console.error("[Plugin operation failed]", {
		operation,
		pluginId,
		error: error instanceof Error ? error.message : String(error),
	})
}

function isPluginDirInside(pluginDir: string, pluginsDir: string): boolean {
	const normalizedPluginDir = pluginDir.replaceAll("\\", "/").replace(/\/+$/g, "")
	const normalizedPluginsDir = pluginsDir.replaceAll("\\", "/").replace(/\/+$/g, "")
	return (
		normalizedPluginDir === normalizedPluginsDir ||
		normalizedPluginDir.startsWith(`${normalizedPluginsDir}/`)
	)
}

function resolvePluginMainPath(pluginDir: string, mainPath: string): string | null {
	const normalized = mainPath.replaceAll("\\", "/").trim()
	const segments = normalized.split("/").filter((segment) => segment && segment !== ".")
	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[a-zA-Z]:/.test(normalized) ||
		segments.length === 0 ||
		segments.some((segment) => segment === "..")
	) {
		return null
	}
	return `${pluginDir}/${segments.join("/")}`
}

async function loadCommunityModule(code: string, pluginId: string): Promise<PluginModule> {
	try {
		return loadCommonJSCommunityModule(code, pluginId)
	} catch (commonJSError) {
		if (!isProbablyESMModule(code)) throw commonJSError
		try {
			return await loadESMCommunityModule(code)
		} catch (esmError) {
			throw new Error(
				`${getErrorMessage(esmError)}; CommonJS fallback failed: ${getErrorMessage(commonJSError)}`,
			)
		}
	}
}

function loadCommonJSCommunityModule(code: string, pluginId: string): PluginModule {
	const moduleExports: Record<string, unknown> = {}
	const moduleObj = { exports: moduleExports as Record<string, unknown> & { default?: unknown } }

	const requireStub = (id: string): unknown => {
		const resolved = communityPluginExternals[id]
		if (resolved) return resolved
		throw new Error(`Cannot require "${id}" in plugin "${pluginId}"`)
	}

	// biome-ignore lint/security/noGlobalEval: required to load community plugin CJS bundles
	const indirectEval = globalThis.eval
	const factory = indirectEval(`(function(module, exports, require) {\n${code}\n})`) as (
		m: typeof moduleObj,
		e: typeof moduleExports,
		r: typeof requireStub,
	) => void
	factory(moduleObj, moduleExports, requireStub)

	return normalizeCommunityModule(moduleObj.exports)
}

async function loadESMCommunityModule(code: string): Promise<PluginModule> {
	const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`
	// oxlint-disable-next-line react-doctor/no-dynamic-import-path -- vault-local plugin ESM bundles must load from generated data URLs
	const moduleExports = await import(/* @vite-ignore */ moduleUrl)
	return normalizeCommunityModule(moduleExports)
}

function normalizeCommunityModule(moduleExports: unknown): PluginModule {
	const exportsRecord = moduleExports as { default?: unknown }
	const defaultExport = exportsRecord.default ?? moduleExports

	if (typeof defaultExport !== "function") {
		throw new Error("Plugin bundle must export a default plugin class")
	}

	return { default: defaultExport as PluginModule["default"] }
}

function isProbablyESMModule(code: string): boolean {
	return (
		/\bexport\s+(default|\{|\*|class|const|function|let|var)/.test(code) || /\bimport\s+/.test(code)
	)
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return String(error)
}
