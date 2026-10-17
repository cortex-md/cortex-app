import type { PluginStoreState } from "./pluginStore"

export interface PluginSyncSnapshot {
	vaultPath: string | null
	plugins: Array<{ id: string; version: string | null; enabled: boolean; community: boolean }>
}

let cachedPlugins: PluginStoreState["plugins"] | null = null
let cachedErrors: PluginStoreState["loadErrors"] | null = null
let cachedVaultPath: string | null = null
let cachedSnapshot: PluginSyncSnapshot = { vaultPath: null, plugins: [] }

export function selectPluginSyncSnapshot(state: PluginStoreState): PluginSyncSnapshot {
	if (
		state.plugins === cachedPlugins &&
		state.loadErrors === cachedErrors &&
		state.loadedVaultPath === cachedVaultPath
	) {
		return cachedSnapshot
	}
	cachedPlugins = state.plugins
	cachedErrors = state.loadErrors
	cachedVaultPath = state.loadedVaultPath
	const plugins: PluginSyncSnapshot["plugins"] = Object.values(state.plugins).map((record) => ({
		id: record.manifest.id,
		version: record.manifest.version ?? null,
		enabled: record.status === "enabled",
		community: record.community,
	}))
	for (const pluginId of Object.keys(state.loadErrors)) {
		if (!state.plugins[pluginId]) {
			plugins.push({ id: pluginId, version: null, enabled: false, community: true })
		}
	}
	cachedSnapshot = { vaultPath: state.loadedVaultPath, plugins }
	return cachedSnapshot
}
