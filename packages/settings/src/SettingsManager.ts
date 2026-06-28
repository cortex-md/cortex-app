import { getPlatform } from "@cortex/platform"
import type { AppSettings, GlobalAppSettings, SettingsChangeEvent } from "./types"
import { AppSettingsSchema, GlobalAppSettingsSchema } from "./types"

const GLOBAL_SETTINGS_FILE_NAME = "settings.json"

export class SettingsManager {
	private cache: AppSettings
	private globalSettings: GlobalAppSettings = GlobalAppSettingsSchema.parse({})
	private globalSettingsLoadedFromFile = false
	private listeners: Set<(event: SettingsChangeEvent) => void> = new Set()
	private saveTimeout: ReturnType<typeof setTimeout> | null = null
	private vaultPath: string | null = null

	constructor(initial: Partial<AppSettings> = {}) {
		this.cache = AppSettingsSchema.parse(initial)
	}

	async loadFromVault(vaultPath: string): Promise<void> {
		this.vaultPath = vaultPath
		let parsed: unknown = {}
		try {
			const platform = getPlatform()
			const content = await platform.fs.readFile(`${vaultPath}/.cortex/app.json`)
			parsed = JSON.parse(content)
		} catch {
			parsed = {}
		}

		this.cache = AppSettingsSchema.parse(parsed)

		if (this.globalSettingsLoadedFromFile) {
			this.applyGlobalSettingsToCache()
		} else {
			await this.loadGlobalSettings(readLegacyNativeWindowEffects(parsed))
		}
	}

	async loadGlobalSettings(fallbackNativeWindowEffects?: boolean | null): Promise<void> {
		try {
			const platform = getPlatform()
			const path = await this.getGlobalSettingsPath()
			const content = await platform.fs.readFile(path)
			this.globalSettings = GlobalAppSettingsSchema.parse(JSON.parse(content))
			this.globalSettingsLoadedFromFile = true
		} catch {
			this.globalSettings = GlobalAppSettingsSchema.parse({
				appearance: {
					nativeWindowEffects:
						fallbackNativeWindowEffects ?? this.cache.appearance.nativeWindowEffects,
				},
			})
			this.globalSettingsLoadedFromFile = false
		}

		this.applyGlobalSettingsToCache()
	}

	get<K extends keyof AppSettings>(section: K, key: keyof AppSettings[K]): unknown {
		return this.cache[section]?.[key as never]
	}

	getSection<K extends keyof AppSettings>(section: K): AppSettings[K] {
		return this.cache[section]
	}

	async set<K extends keyof AppSettings>(
		section: K,
		key: keyof AppSettings[K],
		value: unknown,
	): Promise<void> {
		const oldValue = this.get(section, key)
		const nextCache = AppSettingsSchema.parse({
			...this.cache,
			[section]: {
				...this.cache[section],
				[key]: value,
			},
		})
		const newValue = nextCache[section][key]

		this.cache = nextCache

		this.listeners.forEach((listener) => {
			listener({
				section,
				key: key as string,
				oldValue,
				newValue,
			})
		})

		if (section === "appearance" && key === "nativeWindowEffects") {
			this.globalSettings = GlobalAppSettingsSchema.parse({
				appearance: { nativeWindowEffects: newValue },
			})
			await this.flushGlobalSettings()
			return
		}

		this.scheduleFlush()
	}

	private scheduleFlush(): void {
		if (this.saveTimeout) clearTimeout(this.saveTimeout)
		this.saveTimeout = setTimeout(() => this.flush(), 1000)
	}

	async flush(): Promise<void> {
		if (!this.vaultPath) return

		try {
			const platform = getPlatform()
			const content = JSON.stringify(this.getVaultSettingsSnapshot(), null, 2)
			await platform.fs.writeFile(`${this.vaultPath}/.cortex/app.json`, content)
		} catch (error) {
			console.error("Failed to save settings:", error)
		}
	}

	async flushGlobalSettings(): Promise<void> {
		try {
			const platform = getPlatform()
			const path = await this.getGlobalSettingsPath()
			const content = JSON.stringify(this.globalSettings, null, 2)
			await platform.fs.writeFile(path, content)
			this.globalSettingsLoadedFromFile = true
		} catch (error) {
			console.error("Failed to save global settings:", error)
		}
	}

	subscribe(listener: (event: SettingsChangeEvent) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	getAll(): AppSettings {
		return { ...this.cache }
	}

	private async getGlobalSettingsPath(): Promise<string> {
		const platform = getPlatform()
		const appDataDir = await platform.storage.getAppDataDir()
		return `${appDataDir}/${GLOBAL_SETTINGS_FILE_NAME}`
	}

	private applyGlobalSettingsToCache(): void {
		this.cache = AppSettingsSchema.parse({
			...this.cache,
			appearance: {
				...this.cache.appearance,
				nativeWindowEffects: this.globalSettings.appearance.nativeWindowEffects,
			},
		})
	}

	private getVaultSettingsSnapshot(): AppSettings {
		const { nativeWindowEffects: _nativeWindowEffects, ...appearance } = this.cache.appearance
		return {
			...this.cache,
			appearance,
		} as AppSettings
	}
}

function readLegacyNativeWindowEffects(settings: unknown): boolean | null {
	if (!settings || typeof settings !== "object") return null
	const appearance = (settings as { appearance?: unknown }).appearance
	if (!appearance || typeof appearance !== "object") return null
	const values = appearance as {
		nativeWindowEffects?: unknown
		nativeContentSurface?: unknown
	}
	if (typeof values.nativeWindowEffects === "boolean") return values.nativeWindowEffects
	if (typeof values.nativeContentSurface === "boolean") return values.nativeContentSurface
	return null
}

let instance: SettingsManager

export function getSettingsManager(): SettingsManager {
	if (!instance) {
		instance = new SettingsManager()
	}
	return instance
}

export function initSettingsManager(initial?: Partial<AppSettings>): SettingsManager {
	if (!instance) {
		instance = new SettingsManager(initial)
	}
	return instance
}
