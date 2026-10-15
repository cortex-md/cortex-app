import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { createEmptyStats, findBlockedEntry, isVersionBlocked } from "./catalogData"
import { installPlugin, installTheme, uninstallPlugin, uninstallTheme } from "./installService"
import {
	fetchLatestRelease,
	fetchManifestMetadata,
	fetchPluginRegistry,
	fetchReadme,
	fetchThemeRegistry,
	invalidateRegistryCache,
} from "./registryService"
import {
	fetchBlockedEntries,
	fetchMarketplaceStats,
	fetchVerifiedEntries,
	invalidateStatsCache,
} from "./statsService"
import type {
	BlockedEntry,
	MarketplaceManifestMetadata,
	MarketplacePluginHost,
	MarketplaceStats,
	RegistryEntry,
	VerifiedEntry,
} from "./types"
import { detectAvailableUpdates } from "./updateService"

export interface MarketplaceCallbacks {
	getPluginsDir: () => string | null
	getThemesDir: () => string | null
	pluginHost: MarketplacePluginHost
	reloadThemes: (dir: string) => Promise<void>
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
export type MarketplaceSortOrder = "default" | "popular" | "downloads" | "newest" | "oldest"

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
	stats: MarketplaceStats
	verified: VerifiedEntry[]
	blocked: BlockedEntry[]
	blocklistAvailable: boolean
	statsLoaded: boolean

	setActiveTab: (tab: MarketplaceTab) => void
	setSearchQuery: (query: string) => void
	setFilterInstalled: (value: boolean) => void
	setSortOrder: (order: MarketplaceSortOrder) => void
	selectEntry: (id: string | null) => void
	loadRegistry: () => Promise<void>
	refreshRegistry: () => Promise<void>
	installEntry: (entry: RegistryEntry, kind?: MarketplaceTab) => Promise<void>
	uninstallEntry: (entry: RegistryEntry, kind?: MarketplaceTab) => Promise<void>
	loadReadme: (entry: RegistryEntry) => Promise<void>
	loadManifestMetadata: (entry: RegistryEntry) => Promise<void>
	checkUpdates: () => Promise<void>
	loadReleaseDates: () => Promise<void>
	loadStats: () => Promise<void>
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
			stats: createEmptyStats(),
			verified: [],
			blocked: [],
			blocklistAvailable: false,
			statsLoaded: false,

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
				if (order === "newest" || order === "oldest") {
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
				if (!get().statsLoaded) void get().loadStats()
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
				invalidateStatsCache()
				set((s) => {
					s.statsLoaded = false
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

			installEntry: async (entry, kind) => {
				if (!callbacks) return
				const activeTab = kind ?? get().activeTab
				const wasInstalled =
					activeTab === "plugins"
						? callbacks.pluginHost.isPluginInstalled(entry.id)
						: callbacks.isThemeInstalled(entry.id)
				if (!get().blocklistAvailable) await get().loadStats()
				const blockMessage = getInstallBlockMessage(get(), entry, activeTab)
				if (blockMessage) {
					set((s) => {
						s.installError = blockMessage
					})
					void callbacks.notify?.({
						action: wasInstalled ? "update" : "install",
						kind: activeTab,
						entryId: entry.id,
						title: wasInstalled ? "Update blocked" : "Install blocked",
						body: blockMessage,
						level: "error",
					})
					return
				}
				set((s) => {
					s.loadingEntryId = entry.id
					s.installError = null
				})
				try {
					if (activeTab === "plugins") {
						const dir = callbacks.getPluginsDir()
						if (!dir) throw new Error("Open a vault before installing plugins.")
						await installPlugin(entry, dir, callbacks.pluginHost)
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

			uninstallEntry: async (entry, kind) => {
				if (!callbacks) return
				const activeTab = kind ?? get().activeTab
				set((s) => {
					s.loadingEntryId = entry.id
				})
				try {
					if (activeTab === "plugins") {
						const dir = callbacks.getPluginsDir()
						if (!dir) return
						await uninstallPlugin(entry.id, dir, callbacks.pluginHost)
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
					if (!get().blocklistAvailable) await get().loadStats()
					const { pluginEntries, themeEntries } = get()
					const pluginsDir = callbacks.getPluginsDir()
					const themesDir = callbacks.getThemesDir()

					const installedPluginIds = pluginEntries.flatMap((entry) =>
						callbacks!.pluginHost.isPluginInstalled(entry.id) ? [entry.id] : [],
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

					const { blocked, blocklistAvailable } = get()
					const allowedUpdates = (updates: Record<string, string>, tab: MarketplaceTab) =>
						blocklistAvailable
							? Object.fromEntries(
									Object.entries(updates).filter(
										([id, version]) =>
											!isVersionBlocked(
												findBlockedEntry(blocked, tab === "plugins" ? "plugin" : "theme", id),
												version,
											),
									),
								)
							: {}
					set((s) => {
						s.availableUpdates = {
							...allowedUpdates(pluginUpdates, "plugins"),
							...allowedUpdates(themeUpdates, "themes"),
						}
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
				const { pluginEntries, themeEntries, activeTab, stats } = get()
				const allEntries = activeTab === "plugins" ? pluginEntries : themeEntries
				set((s) => {
					for (const entry of allEntries) {
						const releasedAt = stats[activeTab][entry.id]?.releasedAt
						if (releasedAt && !(entry.id in s.releaseDates)) s.releaseDates[entry.id] = releasedAt
					}
				})
				const releaseDates = get().releaseDates
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

			loadStats: async () => {
				const [stats, verified, blocked] = await Promise.all([
					fetchMarketplaceStats(),
					fetchVerifiedEntries(),
					fetchBlockedEntries(),
				])
				set((s) => {
					s.stats = stats
					s.verified = verified
					s.blocked = blocked ?? []
					s.blocklistAvailable = blocked !== null
					s.statsLoaded = true
					for (const [id, version] of Object.entries(s.availableUpdates)) {
						const kind = s.pluginEntries.some((entry) => entry.id === id) ? "plugin" : "theme"
						if (!blocked || isVersionBlocked(findBlockedEntry(blocked, kind, id), version))
							delete s.availableUpdates[id]
					}
				})
			},
		})),
		{ name: "marketplaceStore" },
	),
)

export const BLOCKLIST_UNAVAILABLE_MESSAGE =
	"The Marketplace block list couldn’t be loaded, so installs and updates are paused. Check your connection and try again."

function getInstallBlockMessage(
	state: Pick<
		MarketplaceState,
		"blocked" | "blocklistAvailable" | "stats" | "manifestMetadataCache" | "availableUpdates"
	>,
	entry: RegistryEntry,
	tab: MarketplaceTab,
): string | null {
	if (!state.blocklistAvailable) return BLOCKLIST_UNAVAILABLE_MESSAGE
	const block = findBlockedEntry(state.blocked, tab === "plugins" ? "plugin" : "theme", entry.id)
	if (!block) return null
	if (block.versions === null)
		return `${entry.name} was removed from the Marketplace: ${block.reason}`
	const version =
		state.availableUpdates[entry.id] ??
		state.manifestMetadataCache[entry.id]?.version ??
		state.stats[tab][entry.id]?.latest ??
		null
	if (!isVersionBlocked(block, version)) return null
	return `${entry.name} ${version} was pulled from the Marketplace: ${block.reason}`
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return String(error)
}

export function isEntryInstalled(id: string, tab: MarketplaceTab): boolean {
	if (!callbacks) return false
	return tab === "plugins"
		? callbacks.pluginHost.isPluginInstalled(id)
		: callbacks.isThemeInstalled(id)
}
