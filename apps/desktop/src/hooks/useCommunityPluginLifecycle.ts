import { getPlatform, type VaultMetadata, type WatchEvent } from "@cortex/platform"
import { disableAllPlugins, loadEnabledPlugins } from "@cortex/plugin-host-core"
import {
	discoverCommunityPlugins,
	reloadCommunityPlugins,
	setCommunityPluginsDir,
} from "@cortex/plugin-host-web"
import { useEffect } from "react"
import { reportAppError } from "../utils/reportAppError"

export function useCommunityPluginLifecycle(vault: VaultMetadata | null): void {
	useEffect(() => {
		if (!vault) {
			void disableAllPlugins()
			return
		}
		let cancelled = false
		let stopPluginsWatcher: (() => void) | null = null
		let pluginReloadTimer: number | null = null
		const getVaultPath = () => vault.path
		const initializePlugins = async () => {
			const pluginsDir = `${vault.path}/.cortex/plugins`
			setCommunityPluginsDir(pluginsDir)
			await getPlatform().fs.createDir(pluginsDir)
			await discoverCommunityPlugins(pluginsDir)
			if (cancelled) return
			await loadEnabledPlugins(vault.path, getVaultPath)
			if (cancelled) return
			const stopWatching = await getPlatform().fs.startWatching(
				pluginsDir,
				(event) => {
					if (!shouldReloadCommunityPluginsForEvent(pluginsDir, event)) return
					if (pluginReloadTimer) window.clearTimeout(pluginReloadTimer)
					pluginReloadTimer = window.setTimeout(() => {
						void reloadCommunityPlugins(pluginsDir, getVaultPath)
					}, 300)
				},
				{ includeHidden: true, followSymlinks: true },
			)
			if (cancelled) {
				stopWatching()
				return
			}
			stopPluginsWatcher = stopWatching
		}
		initializePlugins().catch((error) => {
			void reportAppError({
				operation: "initialize-community-plugins",
				source: "app-lifecycle",
				cause: error,
			})
		})
		return () => {
			cancelled = true
			if (pluginReloadTimer) window.clearTimeout(pluginReloadTimer)
			stopPluginsWatcher?.()
			void disableAllPlugins()
		}
	}, [vault])
}

function shouldReloadCommunityPluginsForEvent(pluginsDir: string, event: WatchEvent): boolean {
	const relativePath = getRelativePluginEventPath(pluginsDir, event.path)
	const segments = relativePath.split("/").filter(Boolean)
	if (segments.length === 0) return false
	if (segments[0]?.startsWith(".")) return false

	if (segments.length === 1) {
		return event.kind === "deleted" || event.kind === "renamed"
	}

	const pluginRuntimePath = segments.slice(1).join("/")
	if (pluginRuntimePath === "settings.json") return false
	if (pluginRuntimePath === "data" || pluginRuntimePath.startsWith("data/")) return false

	return true
}

function getRelativePluginEventPath(pluginsDir: string, eventPath: string): string {
	const normalizedPluginsDir = normalizePath(pluginsDir).replace(/\/+$/, "")
	const normalizedEventPath = normalizePath(eventPath)
	const prefix = `${normalizedPluginsDir}/`
	return normalizedEventPath.startsWith(prefix)
		? normalizedEventPath.slice(prefix.length)
		: normalizedEventPath
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/")
}
