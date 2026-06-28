import type { Disposable, PluginAPI } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

interface ThemeManagerLike {
	getActiveTheme(): { name: string }
	subscribe(listener: (theme: { name: string }) => void): () => void
}

let themeManagerRef: ThemeManagerLike | null = null

export function setThemeManagerRef(manager: ThemeManagerLike): void {
	themeManagerRef = manager
}

export function createThemeAPI(pluginId: string): PluginAPI["theme"] {
	return {
		getActiveThemeName(): string {
			requirePluginCapability(pluginId, "theme:read")
			if (!themeManagerRef) return "ink"
			return themeManagerRef.getActiveTheme().name
		},

		onThemeChange(callback: (name: string) => void): Disposable {
			requirePluginCapability(pluginId, "theme:read")
			if (!themeManagerRef) return { dispose() {} }
			const unsubscribe = themeManagerRef.subscribe((theme) => callback(theme.name))
			return { dispose: unsubscribe }
		},
	}
}
