import { getPlatform } from "@cortex/platform"
import type { CortexPlugin, PluginManifest } from "@cortex.md/api"
import { disposePluginPropertyTypes } from "./apis/PropertiesAPI"
import { pluginHasCapability, validatePluginManifestCapabilities } from "./manifestCapabilities"
import { createPluginAPI } from "./PluginAPIFactory"
import { pluginStore } from "./pluginStore"
import { installPluginMarkdownStyles, removePluginMarkdownStyles } from "./pluginStyles"

interface PluginInstance {
	plugin: CortexPlugin
	manifest: PluginManifest
}

export type PluginConstructor = new () => CortexPlugin

export interface PluginModule {
	default: PluginConstructor
}

export interface CommunityPluginRegistration {
	dirPath: string
	styles?: string | null
}

export interface CommunityPluginEntry {
	pluginId: string
	dirPath: string
}

const instances = new Map<string, PluginInstance>()
const pluginModules = new Map<string, PluginModule>()
const communityPluginLoadErrors = new Map<string, string>()
const communityPluginDirs = new Map<string, string>()
const communityPluginStyles = new Map<string, string>()

function reportPluginOperationError(operation: string, pluginId: string, error: unknown): void {
	console.error("[Plugin operation failed]", {
		operation,
		pluginId,
		error: error instanceof Error ? error.message : String(error),
	})
}

export function runPluginLifecycleInOrder(
	pluginIds: string[],
	operation: (pluginId: string) => Promise<void>,
): Promise<void> {
	return pluginIds.reduce(
		(pendingOperation, pluginId) => pendingOperation.then(() => operation(pluginId)),
		Promise.resolve(),
	)
}

export function registerBundledPlugin(manifest: PluginManifest, module: PluginModule): void {
	validatePluginManifestCapabilities(manifest)
	pluginModules.set(manifest.id, module)
	communityPluginLoadErrors.delete(manifest.id)
	communityPluginDirs.delete(manifest.id)
	communityPluginStyles.delete(manifest.id)
	pluginStore.getState().registerPlugin(manifest)
}

export function registerCommunityPlugin(
	manifest: PluginManifest,
	module: PluginModule,
	registration: CommunityPluginRegistration,
): void {
	validatePluginManifestCapabilities(manifest)
	pluginModules.set(manifest.id, module)
	communityPluginLoadErrors.delete(manifest.id)
	communityPluginDirs.set(manifest.id, registration.dirPath)
	if (registration.styles) {
		communityPluginStyles.set(manifest.id, registration.styles)
	} else {
		communityPluginStyles.delete(manifest.id)
	}
	pluginStore.getState().registerPlugin(manifest)
}

export function unregisterCommunityPlugin(pluginId: string): void {
	pluginModules.delete(pluginId)
	communityPluginLoadErrors.delete(pluginId)
	communityPluginDirs.delete(pluginId)
	communityPluginStyles.delete(pluginId)
	pluginStore.getState().unregisterPlugin(pluginId)
}

export function setCommunityPluginLoadError(pluginId: string, error: string): void {
	pluginModules.delete(pluginId)
	communityPluginDirs.delete(pluginId)
	communityPluginStyles.delete(pluginId)
	communityPluginLoadErrors.set(pluginId, error)
	pluginStore.getState().unregisterPlugin(pluginId)
}

export function clearCommunityPluginRegistration(pluginId: string): void {
	pluginModules.delete(pluginId)
	communityPluginLoadErrors.delete(pluginId)
	communityPluginDirs.delete(pluginId)
	communityPluginStyles.delete(pluginId)
}

export function getCommunityPluginLoadError(pluginId: string): string | null {
	return communityPluginLoadErrors.get(pluginId) ?? null
}

export function getCommunityPluginEntries(): CommunityPluginEntry[] {
	return Array.from(communityPluginDirs, ([pluginId, dirPath]) => ({ pluginId, dirPath }))
}

export function getEnabledCommunityPluginEntries(): CommunityPluginEntry[] {
	return Array.from(instances.keys()).flatMap((pluginId) => {
		const dirPath = communityPluginDirs.get(pluginId)
		return dirPath ? [{ pluginId, dirPath }] : []
	})
}

export async function enablePlugin(
	pluginId: string,
	getVaultPath: () => string | null,
): Promise<void> {
	const store = pluginStore.getState()
	const record = store.plugins[pluginId]
	if (!record) throw new Error(`Plugin not found: ${pluginId}`)
	if (instances.has(pluginId)) return

	const module = pluginModules.get(pluginId)
	if (!module) throw new Error(`Plugin module not found: ${pluginId}`)

	let plugin: CortexPlugin | null = null
	try {
		const PluginClass = module.default
		plugin = new PluginClass()
		const api = createPluginAPI(pluginId, getVaultPath)

		plugin.manifest = record.manifest
		plugin.api = api

		if (pluginHasCapability(pluginId, "settings")) await api.settings.load()
		await plugin.onload()
		installPluginMarkdownStyles(pluginId, communityPluginStyles.get(pluginId) ?? null)

		instances.set(pluginId, { plugin, manifest: record.manifest })
		store.setPluginStatus(pluginId, "enabled")
	} catch (error) {
		removePluginMarkdownStyles(pluginId)
		plugin?._disposeAll()
		disposePluginPropertyTypes(pluginId)
		pluginStore.getState().clearPluginContributions(pluginId)
		store.setPluginStatus(pluginId, "error", String(error))
		throw error
	}
}

export async function disablePlugin(pluginId: string): Promise<void> {
	const instance = instances.get(pluginId)
	removePluginMarkdownStyles(pluginId)
	if (!instance) return

	try {
		await instance.plugin.onunload()
	} catch (error) {
		reportPluginOperationError("unload", pluginId, error)
	}

	instance.plugin._disposeAll()
	disposePluginPropertyTypes(pluginId)
	instances.delete(pluginId)
	pluginStore.getState().clearPluginContributions(pluginId)
	pluginStore.getState().setPluginStatus(pluginId, "disabled")
}

export async function disableAllPlugins(): Promise<void> {
	const pluginIds = Array.from(instances.keys())
	await runPluginLifecycleInOrder(pluginIds, disablePlugin)
}

export async function loadEnabledPlugins(
	vaultPath: string,
	getVaultPath: () => string | null,
): Promise<void> {
	const { ids, isDefault } = await readEnabledPlugins(vaultPath)
	await runPluginLifecycleInOrder(ids, async (pluginId) => {
		if (!pluginModules.has(pluginId)) return
		try {
			await enablePlugin(pluginId, getVaultPath)
		} catch (error) {
			reportPluginOperationError("load-enabled", pluginId, error)
		}
	})
	if (isDefault) {
		await saveEnabledPlugins(vaultPath)
	}
}

async function readEnabledPlugins(
	vaultPath: string,
): Promise<{ ids: string[]; isDefault: boolean }> {
	let content: string
	try {
		content = await getPlatform().fs.readFile(`${vaultPath}/.cortex/plugins.json`)
	} catch {
		return { ids: Array.from(pluginModules.keys()), isDefault: true }
	}

	try {
		const data = JSON.parse(content) as { enabled?: string[] }
		const ids = Array.isArray(data.enabled)
			? data.enabled.filter((id): id is string => typeof id === "string")
			: []
		return { ids, isDefault: false }
	} catch (error) {
		reportPluginOperationError("read-enabled", "registry", error)
		return { ids: [], isDefault: false }
	}
}

export async function saveEnabledPlugins(vaultPath: string): Promise<void> {
	const enabledIds = Array.from(instances.keys())
	const content = JSON.stringify({ enabled: enabledIds }, null, "\t")
	try {
		await getPlatform().fs.writeFile(`${vaultPath}/.cortex/plugins.json`, content)
	} catch (error) {
		reportPluginOperationError("save-enabled", "registry", error)
	}
}

export function getPluginInstance(pluginId: string): CortexPlugin | undefined {
	return instances.get(pluginId)?.plugin
}
