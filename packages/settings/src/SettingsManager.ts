import { getPlatform } from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
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
			const content = await platform.fs.readFile(
				getVaultFilePath(vaultPath, VAULT_FILES.appSettings),
			)
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
		const nextSection = AppSettingsSchema.shape[section].parse({
			...this.cache[section],
			[key]: value,
		}) as AppSettings[K]
		const nextCache = { ...this.cache, [section]: nextSection }
		const newValue = nextSection[key]

		this.cache = nextCache

		this.listeners.forEach((listener) => {
			listener({
				section,
				key: key as string,
				oldValue,
				newValue,
			})
		})

		if (isGlobalSetting(section, key as string)) {
			this.globalSettings = GlobalAppSettingsSchema.parse(pickGlobalSettings(nextCache))
			await this.flushGlobalSettings()
			return
		}

		this.scheduleFlush()
	}

	applyExternalSettings(settings: AppSettings): void {
		this.cache = settings
		this.globalSettings = GlobalAppSettingsSchema.parse(pickGlobalSettings(settings))
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
			await platform.fs.atomicWriteFile(
				getVaultFilePath(this.vaultPath, VAULT_FILES.appSettings),
				content,
			)
		} catch (error) {
			console.error("Failed to save settings:", error)
		}
	}

	async flushGlobalSettings(): Promise<void> {
		try {
			const platform = getPlatform()
			const path = await this.getGlobalSettingsPath()
			const content = JSON.stringify(this.globalSettings, null, 2)
			await platform.fs.atomicWriteFile(path, content)
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
				...this.globalSettings.appearance,
			},
			plugins: this.globalSettings.plugins,
			updates: this.globalSettings.updates,
		})
	}

	private getVaultSettingsSnapshot(): Omit<AppSettings, "plugins" | "updates"> {
		const { plugins: _plugins, updates: _updates, ...cache } = this.cache
		const {
			nativeWindowEffects: _nativeWindowEffects,
			workspaceMode: _workspaceMode,
			...appearance
		} = cache.appearance
		return { ...cache, appearance } as Omit<AppSettings, "plugins" | "updates">
	}
}

const GLOBAL_APPEARANCE_KEYS = new Set(["nativeWindowEffects", "workspaceMode"])

function isGlobalSetting(section: keyof AppSettings, key: string): boolean {
	return (
		section === "plugins" ||
		section === "updates" ||
		(section === "appearance" && GLOBAL_APPEARANCE_KEYS.has(key))
	)
}

function pickGlobalSettings(settings: AppSettings): unknown {
	return {
		appearance: {
			nativeWindowEffects: settings.appearance.nativeWindowEffects,
			workspaceMode: settings.appearance.workspaceMode,
		},
		plugins: settings.plugins,
		updates: settings.updates,
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
