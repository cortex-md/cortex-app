import { getPlatform } from "@cortex/platform"
import type { Disposable, PluginAPI, PluginSettingDefinition } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

type SettingsChangeCallback = (value: unknown, oldValue: unknown) => void

export function createSettingsAPI(
	pluginId: string,
	getVaultPath: () => string | null,
): PluginAPI["settings"] {
	const listeners = new Map<string, Set<SettingsChangeCallback>>()
	let cache: Record<string, unknown> | null = null

	function settingsFilePath(): string | null {
		const vaultPath = getVaultPath()
		if (!vaultPath) return null
		return `${vaultPath}/.cortex/plugins/${pluginId}/settings.json`
	}

	async function loadSettings(): Promise<Record<string, unknown>> {
		if (cache) return cache
		const filePath = settingsFilePath()
		if (!filePath) return {}
		try {
			const content = await getPlatform().fs.readFile(filePath)
			cache = JSON.parse(content) as Record<string, unknown>
			return cache
		} catch (error) {
			console.warn("[Plugin settings load failed]", {
				pluginId,
				filePath,
				error: error instanceof Error ? error.message : String(error),
			})
			cache = {}
			return cache
		}
	}

	async function saveSettings(data: Record<string, unknown>): Promise<void> {
		const filePath = settingsFilePath()
		if (!filePath) return
		const dirPath = filePath.replace(/\/[^/]+$/, "")
		const platform = getPlatform()
		await platform.fs.createDir(dirPath)
		await platform.fs.writeFile(filePath, JSON.stringify(data, null, "\t"))
	}

	return {
		async load(): Promise<void> {
			requirePluginCapability(pluginId, "settings")
			await loadSettings()
		},

		get<T>(key: string): T | undefined {
			requirePluginCapability(pluginId, "settings")
			if (!cache) return undefined
			return cache[key] as T | undefined
		},

		async set<T>(key: string, value: T): Promise<void> {
			requirePluginCapability(pluginId, "settings")
			const data = await loadSettings()
			const oldValue = data[key]
			if (Object.is(oldValue, value)) return
			data[key] = value
			cache = data
			await saveSettings(data)

			const keyListeners = listeners.get(key)
			if (keyListeners) {
				for (const callback of keyListeners) {
					callback(value, oldValue)
				}
			}
		},

		getAll(): Record<string, unknown> {
			requirePluginCapability(pluginId, "settings")
			return cache ?? {}
		},

		onChange(key: string, callback: SettingsChangeCallback): Disposable {
			requirePluginCapability(pluginId, "settings")
			let keyListeners = listeners.get(key)
			if (!keyListeners) {
				keyListeners = new Set()
				listeners.set(key, keyListeners)
			}
			keyListeners.add(callback)
			return {
				dispose() {
					keyListeners.delete(callback)
					if (keyListeners.size === 0) {
						listeners.delete(key)
					}
				},
			}
		},

		defineSchema(_schema: PluginSettingDefinition[]): void {
			requirePluginCapability(pluginId, "settings")
		},
	}
}
