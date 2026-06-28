import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { installPlugin, installTheme, uninstallPlugin, uninstallTheme } from "./installService"
import {
	fetchLatestRelease,
	fetchManifestMetadata,
	fetchPluginRegistry,
	fetchReadme,
	fetchThemeRegistry,
	invalidateRegistryCache,
} from "./registryService"
import type { MarketplaceManifestMetadata, RegistryEntry } from "./types"
import { detectAvailableUpdates } from "./updateService"

export interface MarketplaceCallbacks {
	getPluginsDir: () => string | null
	getThemesDir: () => string | null
	reloadPluginHost: (dir: string) => Promise<void>
	reloadThemes: (dir: string) => Promise<void>
	isPluginInstalled: (id: string) => boolean
	isThemeInstalled: (id: string) => boolean
	notify?: (event: MarketplaceNotificationEvent) => void | Promise<void>
}

export interface MarketplaceNotificationEvent {
	action: "install" | "update" | "uninstall"
	kind: MarketplaceTab
	entryId: string
	title: string
	body?: string
	level: "success" | "error"
}

let callbacks: MarketplaceCallbacks | null = null

export function setMarketplaceCallbacks(cbs: MarketplaceCallbacks): void {
	callbacks = cbs
}

export type MarketplaceTab = "plugins" | "themes"
export type MarketplaceSortOrder = "default" | "newest" | "oldest"

export interface MarketplaceState {
	pluginEntries: RegistryEntry[]
	themeEntries: RegistryEntry[]
	activeTab: MarketplaceTab
	searchQuery: string
	filterInstalled: boolean
	sortOrder: MarketplaceSortOrder
	selectedEntryId: string | null
	loadingEntryId: string | null
	installError: string | null
	registryError: string | null
	readmeCache: Record<string, string>
	readmeLoading: boolean
	appVersion: string | null
	minVersionCache: Record<string, string>
	manifestMetadataCache: Record<string, MarketplaceManifestMetadata>
	manifestMetadataLoading: Record<string, boolean>
	availableUpdates: Record<string, string>
	updatesChecking: boolean
	updatesChecked: boolean
	releaseDates: Record<string, string>
	releaseDatesLoading: boolean

	setActiveTab: (tab: MarketplaceTab) => void
	setSearchQuery: (query: string) => void
	setFilterInstalled: (value: boolean) => void
	setSortOrder: (order: MarketplaceSortOrder) => void
	selectEntry: (id: string | null) => void
	loadRegistry: () => Promise<void>
	refreshRegistry: () => Promise<void>
	installEntry: (entry: RegistryEntry) => Promise<void>
	uninstallEntry: (entry: RegistryEntry) => Promise<void>
	loadReadme: (entry: RegistryEntry) => Promise<void>
	loadManifestMetadata: (entry: RegistryEntry) => Promise<void>
	checkUpdates: () => Promise<void>
	loadReleaseDates: () => Promise<void>
}

export const useMarketplaceStore = create<MarketplaceState>()(
	devtools(
		immer((set, get) => ({
			pluginEntries: [],
			themeEntries: [],
			activeTab: "plugins" as MarketplaceTab,
			searchQuery: "",
			filterInstalled: false,
			sortOrder: "default" as MarketplaceSortOrder,
			selectedEntryId: null,
			loadingEntryId: null,
			installError: null,
			registryError: null,
			readmeCache: {},
			readmeLoading: false,
			appVersion: null,
			minVersionCache: {},
			manifestMetadataCache: {},
			manifestMetadataLoading: {},
			availableUpdates: {},
			updatesChecking: false,
			updatesChecked: false,
			releaseDates: {},
			releaseDatesLoading: false,

			setActiveTab: (tab) =>
				set((s) => {
					s.activeTab = tab
					s.searchQuery = ""
					s.filterInstalled = false
					s.sortOrder = "default"
					s.selectedEntryId = null
					s.installError = null
				}),

			setSearchQuery: (query) =>
				set((s) => {
					s.searchQuery = query
				}),

			setFilterInstalled: (value) =>
				set((s) => {
					s.filterInstalled = value
				}),

			setSortOrder: (order) => {
				set((s) => {
					s.sortOrder = order
				})
				if (order !== "default") {
					get().loadReleaseDates()
				}
			},

			selectEntry: (id) => {
				set((s) => {
					s.selectedEntryId = id
					s.installError = null
				})

				if (!id) return
				const { pluginEntries, themeEntries, activeTab } = get()
				const allEntries = activeTab === "plugins" ? pluginEntries : themeEntries
				const entry = allEntries.find((e) => e.id === id)
				if (!entry) return

				get().loadManifestMetadata(entry)
			},

			loadRegistry: async () => {
				if (get().pluginEntries.length > 0 && get().themeEntries.length > 0) return
				try {
					const [plugins, themes] = await Promise.all([fetchPluginRegistry(), fetchThemeRegistry()])
					set((s) => {
						s.pluginEntries = plugins
						s.themeEntries = themes
						s.registryError = null
					})
					if (!get().updatesChecked) {
						get().checkUpdates()
					}
					if (!get().appVersion) {
						getPlatform()
							.app.getCurrentAppVersion()
							.then((version) => {
								set((s) => {
									s.appVersion = version
								})
							})
							.catch(() => {})
					}
				} catch (e) {
					set((s) => {
						s.registryError = String(e)
					})
				}
			},

			refreshRegistry: async () => {
				invalidateRegistryCache()
				set((s) => {
					s.pluginEntries = []
					s.themeEntries = []
					s.registryError = null
					s.availableUpdates = {}
					s.updatesChecked = false
					s.manifestMetadataCache = {}
					s.manifestMetadataLoading = {}
					s.minVersionCache = {}
				})
				await get().loadRegistry()
			},

			installEntry: async (entry) => {
				if (!callbacks) return
				const { activeTab } = get()
				const wasInstalled =
					activeTab === "plugins"
						? callbacks.isPluginInstalled(entry.id)
						: callbacks.isThemeInstalled(entry.id)
				set((s) => {
					s.loadingEntryId = entry.id
					s.installError = null
				})
				try {
					if (activeTab === "plugins") {
						const dir = callbacks.getPluginsDir()
						if (!dir) throw new Error("Open a vault before installing plugins.")
						await installPlugin(entry, dir, callbacks.reloadPluginHost)
					} else {
						const dir = callbacks.getThemesDir()
						if (!dir) throw new Error("Open a vault before installing themes.")
						await installTheme(entry, dir, callbacks.reloadThemes)
					}
					set((s) => {
						delete s.availableUpdates[entry.id]
						s.installError = null
					})
					void callbacks.notify?.({
						action: wasInstalled ? "update" : "install",
						kind: activeTab,
						entryId: entry.id,
						title: wasInstalled ? "Update installed" : "Install complete",
						body: entry.name,
						level: "success",
					})
				} catch (error) {
					const message = getErrorMessage(error)
					set((s) => {
						s.installError = message
					})
					void callbacks.notify?.({
						action: wasInstalled ? "update" : "install",
						kind: activeTab,
						entryId: entry.id,
						title: wasInstalled ? "Update failed" : "Install failed",
						body: message,
						level: "error",
					})
				} finally {
					set((s) => {
						s.loadingEntryId = null
					})
				}
			},

			uninstallEntry: async (entry) => {
				if (!callbacks) return
				const { activeTab } = get()
				set((s) => {
					s.loadingEntryId = entry.id
				})
				try {
					if (activeTab === "plugins") {
						const dir = callbacks.getPluginsDir()
						if (!dir) return
						await uninstallPlugin(entry.id, dir)
					} else {
						const dir = callbacks.getThemesDir()
						if (!dir) return
						await uninstallTheme(entry.id, dir)
					}
					void callbacks.notify?.({
						action: "uninstall",
						kind: activeTab,
						entryId: entry.id,
						title: "Uninstall complete",
						body: entry.name,
						level: "success",
					})
				} catch (error) {
					void callbacks.notify?.({
						action: "uninstall",
						kind: activeTab,
						entryId: entry.id,
						title: "Uninstall failed",
						body: getErrorMessage(error),
						level: "error",
					})
					throw error
				} finally {
					set((s) => {
						s.loadingEntryId = null
					})
				}
			},

			loadReadme: async (entry) => {
				const cached = get().readmeCache[entry.id]
				if (cached !== undefined) return
				set((s) => {
					s.readmeLoading = true
				})
				try {
					const readme = await fetchReadme(entry.repo)
					set((s) => {
						s.readmeCache[entry.id] = readme
						s.readmeLoading = false
					})
				} catch {
					set((s) => {
						s.readmeCache[entry.id] = ""
						s.readmeLoading = false
					})
				}
			},

			loadManifestMetadata: async (entry) => {
				const { manifestMetadataCache, manifestMetadataLoading } = get()
				if (entry.id in manifestMetadataCache || manifestMetadataLoading[entry.id]) return

				set((s) => {
					s.manifestMetadataLoading[entry.id] = true
				})
				try {
					const metadata = await fetchManifestMetadata(entry.repo)
					set((s) => {
						s.manifestMetadataCache[entry.id] = metadata
						if (metadata.minAppVersion) {
							s.minVersionCache[entry.id] = metadata.minAppVersion
						} else {
							delete s.minVersionCache[entry.id]
						}
					})
				} catch {
					set((s) => {
						s.manifestMetadataCache[entry.id] = {
							version: null,
							minAppVersion: null,
							capabilities: [],
						}
						delete s.minVersionCache[entry.id]
					})
				} finally {
					set((s) => {
						delete s.manifestMetadataLoading[entry.id]
					})
				}
			},

			checkUpdates: async () => {
				if (!callbacks || get().updatesChecking) return
				set((s) => {
					s.updatesChecking = true
				})
				try {
					const { pluginEntries, themeEntries } = get()
					const pluginsDir = callbacks.getPluginsDir()
					const themesDir = callbacks.getThemesDir()

					const installedPluginIds = pluginEntries.flatMap((entry) =>
						callbacks!.isPluginInstalled(entry.id) ? [entry.id] : [],
					)

					const installedThemeIds = themeEntries.flatMap((entry) =>
						callbacks!.isThemeInstalled(entry.id) ? [entry.id] : [],
					)

					const [pluginUpdates, themeUpdates] = await Promise.all([
						pluginsDir && installedPluginIds.length > 0
							? detectAvailableUpdates(pluginEntries, installedPluginIds, pluginsDir)
							: Promise.resolve({}),
						themesDir && installedThemeIds.length > 0
							? detectAvailableUpdates(themeEntries, installedThemeIds, themesDir)
							: Promise.resolve({}),
					])

					set((s) => {
						s.availableUpdates = { ...pluginUpdates, ...themeUpdates }
						s.updatesChecked = true
					})
				} catch {
					set((s) => {
						s.updatesChecked = true
					})
				} finally {
					set((s) => {
						s.updatesChecking = false
					})
				}
			},

			loadReleaseDates: async () => {
				if (get().releaseDatesLoading) return
				const { pluginEntries, themeEntries, activeTab, releaseDates } = get()
				const allEntries = activeTab === "plugins" ? pluginEntries : themeEntries
				const uncached = allEntries.filter((e) => !(e.id in releaseDates))
				if (uncached.length === 0) return

				set((s) => {
					s.releaseDatesLoading = true
				})
				try {
					const results = await Promise.allSettled(
						uncached.map(async (entry) => {
							const release = await fetchLatestRelease(entry.repo)
							return { id: entry.id, date: release.published_at }
						}),
					)
					set((s) => {
						for (const result of results) {
							if (result.status === "fulfilled") {
								s.releaseDates[result.value.id] = result.value.date
							}
						}
					})
				} finally {
					set((s) => {
						s.releaseDatesLoading = false
					})
				}
			},
		})),
		{ name: "marketplaceStore" },
	),
)

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return String(error)
}

export function isEntryInstalled(id: string, tab: MarketplaceTab): boolean {
	if (!callbacks) return false
	return tab === "plugins" ? callbacks.isPluginInstalled(id) : callbacks.isThemeInstalled(id)
}
