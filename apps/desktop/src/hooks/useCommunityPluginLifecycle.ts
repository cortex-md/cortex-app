import { reportAppError } from "@cortex/core"
import type { VaultMetadata, WatchEvent } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useEffect, useRef } from "react"
import { pluginHost } from "../bootstrap/pluginHost"
import { useWatchedDirectory } from "./useWatchedDirectory"

export function useCommunityPluginLifecycle(vault: VaultMetadata | null): void {
	const allowCommunity = useSettingsStore((state) => state.settings.plugins.allowCommunity)
	const appliedAllowCommunity = useRef(allowCommunity)

	useEffect(() => {
		if (!vault) void pluginHost.disableAllPlugins()
	}, [vault])

	useEffect(() => {
		if (appliedAllowCommunity.current === allowCommunity) return
		appliedAllowCommunity.current = allowCommunity
		pluginHost.syncCommunityAccess().catch((error: unknown) => {
			void reportAppError({
				operation: "sync-community-plugin-access",
				source: "app-lifecycle",
				cause: error,
			})
		})
	}, [allowCommunity])

	useWatchedDirectory(vault ? `${vault.path}/.cortex/plugins` : null, {
		load: async (pluginsDir, signal) => {
			await pluginHost.discoverCommunityPlugins(pluginsDir)
			if (signal.aborted) return
			await pluginHost.loadEnabledPlugins()
		},
		reload: (pluginsDir) => pluginHost.reloadCommunityPlugins(pluginsDir),
		unload: () => void pluginHost.disableAllPlugins(),
		shouldReload: shouldReloadCommunityPluginsForEvent,
		onError: (operation, error) => {
			void reportAppError({
				operation:
					operation === "load" ? "initialize-community-plugins" : "reload-community-plugins",
				source: "app-lifecycle",
				cause: error,
			})
		},
	})
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
