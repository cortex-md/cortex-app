import {
	LEFT_SIDEBAR_WIDTH_BOUNDS,
	noteCache,
	type OpenVaultOptions,
	type SplitTree,
	useAppStore,
	useAuthStore,
	useBookmarksStore,
	useDragStore,
	useEditorStore,
	useTagsStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
	type VaultMetadata,
	type VaultRegistryEntry,
} from "@cortex/core"
import { loadEditorRuntime } from "@cortex/editor/runtime"
import { useHotkeyListener, useHotkeysStore } from "@cortex/hotkeys"
import { type FileEntry, getPlatform } from "@cortex/platform"
import { PluginModalHost, PluginViewRenderer, usePluginStore } from "@cortex/plugin-host-web"
import { useSearchStore } from "@cortex/search"
import { useSettingsStore } from "@cortex/settings"
import { Button } from "@cortex/ui"
import { listen } from "@tauri-apps/api/event"
import {
	BookmarkIcon,
	FolderClosed,
	PanelLeftIcon,
	SearchIcon,
	SettingsIcon,
	StoreIcon,
	TagIcon,
} from "lucide-react"
import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { initializePluginBridges } from "./bootstrap/pluginBridges"
import { AuthModal } from "./features/auth/AuthModal"
import { BookmarksSidebar } from "./features/bookmarks/BookmarksSidebar"
import { CommandPalette } from "./features/command-palette/CommandPalette"
import { FileSidebar } from "./features/file-explorer/FileSidebar"
import { SidebarViewCarousel } from "./features/file-explorer/SidebarViewCarousel"
import { SidebarViewStage } from "./features/file-explorer/SidebarViewStage"
import {
	getAvailableSidebarViewId,
	type SidebarViewItem,
	type SidebarViewPanelProps,
} from "./features/file-explorer/sidebarViewUtils"
import { EmptyVaultLayout } from "./features/layout/empty-vault-layout"
import { type SplitPaneLeafProps, SplitPaneView } from "./features/layout/SplitPane"
import {
	type MarketplaceOpenRequest,
	openMarketplaceView,
} from "./features/marketplace/openMarketplaceView"
import { openPendingOnboardingNote } from "./features/onboarding/openPendingOnboardingNote"
import { QuickFinder } from "./features/quick-finder/QuickFinder"
import { SearchSidebar } from "./features/search/SearchSidebar"
import { SettingsModal } from "./features/settings/SettingsModal"
import { DragPreview } from "./features/split-view/DragPreview"
import { PaneView } from "./features/split-view/PaneView"
import { StatusBar } from "./features/statusbar/StatusBar"
import { TagPicker } from "./features/tags/TagPicker"
import { TagsSidebar } from "./features/tags/TagsSidebar"
import { CreateFromTemplateDialog } from "./features/templates/CreateFromTemplateDialog"
import { VaultSwitcher } from "./features/vault/VaultSwitcher"
import { useAppCommands } from "./hooks/useAppCommands"
import { useAppUpdateLifecycle } from "./hooks/useAppUpdates"
import { useCommunityPluginLifecycle } from "./hooks/useCommunityPluginLifecycle"
import { useCommunityThemeLifecycle } from "./hooks/useCommunityThemeLifecycle"
import { useNativeMenuEvents } from "./hooks/useNativeMenuEvents"
import { useNativeNotifications } from "./hooks/useNativeNotifications"
import { useSidebarResize } from "./hooks/useSidebarResize"
import { useSyncBillingDeepLink } from "./hooks/useSyncBillingDeepLink"
import { useSyncLifecycle } from "./hooks/useSyncLifecycle"
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence"

initializePluginBridges()

const CORE_SIDEBAR_VIEWS: SidebarViewItem[] = [
	{ id: "files", icon: FolderClosed, label: "Files", source: "core" },
	{ id: "search", icon: SearchIcon, label: "Search", source: "core" },
	{ id: "bookmarks", icon: BookmarkIcon, label: "Bookmarks", source: "core" },
	{ id: "tags", icon: TagIcon, label: "Tags", source: "core" },
]

type OpenVault = (path: string, options?: OpenVaultOptions) => Promise<void>
type VaultPathTask = (vaultPath: string) => Promise<void> | void
type ResizeSplit = (nodeId: string, sizes: number[]) => void
type StartWorkspacePersistence = ReturnType<typeof useWorkspacePersistence>

interface AppTitlebarProps {
	vault: VaultMetadata | null
	leftSidebarCollapsed: boolean
	leftSidebarWidth: number
	onToggleLeftSidebar: () => void
}

interface AppContentProps {
	vault: VaultMetadata | null
	leftSidebarCollapsed: boolean
	leftSidebarWidth: number
	sidebarElementRef: RefObject<HTMLElement | null>
	sidebarViews: SidebarViewItem[]
	activeSidebarView: string
	splitTree: SplitTree
	onSidebarViewSelect: (id: string) => void
	onSidebarResizeStart: (event: ReactPointerEvent<HTMLElement>) => void
	onOpenMarketplace: () => void
	onOpenSettings: () => void
	onResizeSplit: ResizeSplit
}

interface SidebarShellProps {
	leftSidebarCollapsed: boolean
	leftSidebarWidth: number
	sidebarElementRef: RefObject<HTMLElement | null>
	sidebarViews: SidebarViewItem[]
	activeSidebarView: string
	onSidebarViewSelect: (id: string) => void
	onSidebarResizeStart: (event: ReactPointerEvent<HTMLElement>) => void
	onOpenMarketplace: () => void
	onOpenSettings: () => void
}

interface WorkspaceShellProps {
	leftSidebarCollapsed: boolean
	splitTree: SplitTree
	onResizeSplit: ResizeSplit
}

interface AppOverlaysProps {
	settingsModalOpen: boolean
	onSettingsModalOpenChange: (open: boolean) => void
}

interface LastVaultAutoOpenOptions {
	vault: VaultMetadata | null
	recentVaults: VaultRegistryEntry[]
	autoOpenLastVault: boolean
	openVault: OpenVault
}

interface VaultWorkspaceLifecycleOptions {
	vault: VaultMetadata | null
	loadWorkspace: (vaultPath: string) => Promise<void>
	startWorkspacePersistence: StartWorkspacePersistence
	resetWorkspace: () => void
	resetSearch: () => void
	resetTags: () => void
	resetBookmarks: () => void
	loadSettings: VaultPathTask
	loadOverrides: VaultPathTask
	loadBookmarks: VaultPathTask
	loadTagColors: VaultPathTask
}

interface SettingsWindowBridgeOptions {
	settingsOpen: boolean
	settingsInitialSection: string | null
	vault: VaultMetadata | null
	closeSettings: () => void
}

function SidebarViewPanel({ id }: SidebarViewPanelProps) {
	const pluginSidebarItems = usePluginStore((s) => s.sidebarItems)
	const pluginViews = usePluginStore((s) => s.views)

	if (id === "files") return <FileSidebar />
	if (id === "search") return <SearchSidebar />
	if (id === "bookmarks") return <BookmarksSidebar />
	if (id === "tags") return <TagsSidebar />
	const sidebarItem = pluginSidebarItems.find((item) => item.registrationKey === id)
	const pluginView = pluginViews.find(
		(view) => view.pluginId === sidebarItem?.pluginId && view.id === sidebarItem.viewId,
	)
	return pluginView ? (
		<div className="h-full min-h-0 overflow-hidden">
			<PluginViewRenderer registration={pluginView} />
		</div>
	) : null
}

function SplitPaneLeaf({ paneId }: SplitPaneLeafProps) {
	return <PaneView paneId={paneId} />
}

function AppTitlebar({
	vault,
	leftSidebarCollapsed,
	leftSidebarWidth,
	onToggleLeftSidebar,
}: AppTitlebarProps) {
	const titlebarStyle = {
		"--app-titlebar-drag-width": `${leftSidebarCollapsed ? 118 : leftSidebarWidth}px`,
	} as CSSProperties

	return (
		<div className="app-titlebar h-10 pl-24 flex-shrink-0" style={titlebarStyle}>
			<div data-tauri-drag-region className="app-titlebar-drag-region" aria-hidden="true" />
			{vault && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={`app-sidebar-toggle ${
						leftSidebarCollapsed ? "app-sidebar-toggle--collapsed" : ""
					}`}
					aria-label={leftSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
					aria-pressed={!leftSidebarCollapsed}
					title={leftSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
					onClick={onToggleLeftSidebar}
				>
					<PanelLeftIcon size={16} strokeWidth={2} />
				</Button>
			)}
		</div>
	)
}

function AppContent({
	vault,
	leftSidebarCollapsed,
	leftSidebarWidth,
	sidebarElementRef,
	sidebarViews,
	activeSidebarView,
	splitTree,
	onSidebarViewSelect,
	onSidebarResizeStart,
	onOpenMarketplace,
	onOpenSettings,
	onResizeSplit,
}: AppContentProps) {
	return (
		<div className="app-content flex flex-1 overflow-hidden">
			{!vault ? (
				<EmptyVaultLayout />
			) : (
				<>
					<SidebarShell
						leftSidebarCollapsed={leftSidebarCollapsed}
						leftSidebarWidth={leftSidebarWidth}
						sidebarElementRef={sidebarElementRef}
						sidebarViews={sidebarViews}
						activeSidebarView={activeSidebarView}
						onSidebarViewSelect={onSidebarViewSelect}
						onSidebarResizeStart={onSidebarResizeStart}
						onOpenMarketplace={onOpenMarketplace}
						onOpenSettings={onOpenSettings}
					/>
					<WorkspaceShell
						leftSidebarCollapsed={leftSidebarCollapsed}
						splitTree={splitTree}
						onResizeSplit={onResizeSplit}
					/>
				</>
			)}
		</div>
	)
}

function SidebarShell({
	leftSidebarCollapsed,
	leftSidebarWidth,
	sidebarElementRef,
	sidebarViews,
	activeSidebarView,
	onSidebarViewSelect,
	onSidebarResizeStart,
	onOpenMarketplace,
	onOpenSettings,
}: SidebarShellProps) {
	return (
		<>
			<aside
				ref={sidebarElementRef}
				className={`app-sidebar flex-shrink-0 bg-sidebar-bg border-r border-sidebar-border flex flex-col overflow-hidden ${
					leftSidebarCollapsed ? "app-sidebar--collapsed" : ""
				}`}
				style={{
					width: leftSidebarCollapsed ? 0 : leftSidebarWidth,
					minWidth: leftSidebarCollapsed ? 0 : LEFT_SIDEBAR_WIDTH_BOUNDS.min,
					maxWidth: leftSidebarCollapsed ? 0 : LEFT_SIDEBAR_WIDTH_BOUNDS.max,
				}}
				aria-label="Sidebar panel"
			>
				<VaultSwitcher />
				<SidebarViewCarousel
					items={sidebarViews}
					activeId={activeSidebarView}
					onSelect={onSidebarViewSelect}
				/>
				<div className="min-h-0 flex-1 overflow-hidden">
					<SidebarViewStage
						activeId={activeSidebarView}
						items={sidebarViews}
						ViewComponent={SidebarViewPanel}
					/>
				</div>
				<div className="sidebar-footer">
					<Button
						type="button"
						variant="ghost"
						className="sidebar-footer-button"
						onClick={onOpenMarketplace}
					>
						<StoreIcon size={16} strokeWidth={2} />
						<span>Marketplace</span>
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="sidebar-footer-button"
						onClick={onOpenSettings}
					>
						<SettingsIcon size={16} strokeWidth={2} />
						<span>Settings</span>
					</Button>
				</div>
			</aside>
			<div
				className={`app-sidebar-resizer w-[3px] flex-shrink-0 cursor-col-resize bg-transparent hover:bg-accent transition-colors duration-150 ${
					leftSidebarCollapsed ? "app-sidebar-resizer--hidden" : ""
				}`}
				onPointerDown={onSidebarResizeStart}
				aria-hidden="true"
			/>
		</>
	)
}

function WorkspaceShell({ leftSidebarCollapsed, splitTree, onResizeSplit }: WorkspaceShellProps) {
	return (
		<main
			className="app-main flex-1 overflow-hidden flex flex-col min-w-0 bg-bg-primary"
			data-left-sidebar-collapsed={leftSidebarCollapsed ? "true" : undefined}
		>
			<div className="flex-1 min-h-0 overflow-hidden">
				<SplitPaneView node={splitTree} LeafComponent={SplitPaneLeaf} onResize={onResizeSplit} />
			</div>
			<StatusBar />
		</main>
	)
}

function AppOverlays({ settingsModalOpen, onSettingsModalOpenChange }: AppOverlaysProps) {
	return (
		<>
			<SettingsModal open={settingsModalOpen} onOpenChange={onSettingsModalOpenChange} />
			<AuthModal />
			<QuickFinder />
			<CommandPalette />
			<TagPicker />
			<CreateFromTemplateDialog />
			<PluginModalHost />
			<DragPreview />
		</>
	)
}

function useSidebarViews(): SidebarViewItem[] {
	const pluginSidebarItems = usePluginStore((s) => s.sidebarItems)
	const pluginViews = usePluginStore((s) => s.views)

	return useMemo<SidebarViewItem[]>(() => {
		const sidebarPluginViewIds = new Set(
			pluginViews.flatMap((view) =>
				view.location === "sidebar-left" ? [view.registrationKey] : [],
			),
		)
		const pluginNavItems = pluginSidebarItems.flatMap((item) =>
			sidebarPluginViewIds.has(`${item.pluginId}:${item.viewId}`)
				? [
						{
							id: item.registrationKey,
							viewId: `${item.pluginId}:${item.viewId}`,
							icon: item.icon,
							label: item.label,
							source: "extension" as const,
						},
					]
				: [],
		)
		return [...CORE_SIDEBAR_VIEWS, ...pluginNavItems]
	}, [pluginSidebarItems, pluginViews])
}

function useAppStartup(
	loadAppInfo: () => Promise<void>,
	loadFirstRunOnboarding: () => Promise<void>,
	loadRecentVaults: () => Promise<void>,
) {
	useEffect(() => {
		void loadAppInfo()
		void loadFirstRunOnboarding()
		void loadRecentVaults()
	}, [loadAppInfo, loadFirstRunOnboarding, loadRecentVaults])
}

function useFirstRunOnboardingMarker(
	firstRunOnboardingSeen: boolean | null,
	recentVaultCount: number,
	vault: VaultMetadata | null,
	markFirstRunOnboardingSeen: () => Promise<void>,
) {
	useEffect(() => {
		if (firstRunOnboardingSeen !== false) return
		if (!vault && recentVaultCount === 0) return
		void markFirstRunOnboardingSeen()
	}, [firstRunOnboardingSeen, markFirstRunOnboardingSeen, recentVaultCount, vault])
}

function useAuthSessionWatcher() {
	useEffect(() => {
		const { loadPreferences, checkAuth } = useAuthStore.getState()
		void loadPreferences().then(() => checkAuth())

		const unlisten = listen("auth-session-expired", () => {
			void useAuthStore.getState().logout()
		})
		return () => {
			void unlisten.then((fn) => fn())
		}
	}, [])
}

function useMarketplaceOpenEvents() {
	useEffect(() => {
		const unlisten = listen<MarketplaceOpenRequest | MarketplaceOpenRequest["tab"]>(
			"marketplace-open",
			(event) => {
				const payload = event.payload
				if (!payload || typeof payload === "string") {
					openMarketplaceView(payload ?? "plugins")
					return
				}
				openMarketplaceView(payload.tab, { selectedEntryId: payload.selectedEntryId })
			},
		)
		return () => {
			void unlisten.then((fn) => fn())
		}
	}, [])
}

function useLastVaultAutoOpen({
	vault,
	recentVaults,
	autoOpenLastVault,
	openVault,
}: LastVaultAutoOpenOptions) {
	const autoOpenAttempted = useRef(false)

	useEffect(() => {
		if (autoOpenAttempted.current || vault) return

		const params = new URLSearchParams(window.location.search)
		const vaultFromUrl = params.get("vault")
		if (vaultFromUrl) {
			autoOpenAttempted.current = true
			void openVault(decodeURIComponent(vaultFromUrl))
			return
		}

		if (recentVaults.length === 0) return
		if (!autoOpenLastVault) {
			autoOpenAttempted.current = true
			return
		}

		autoOpenAttempted.current = true
		const lastVault = recentVaults[0]
		void openVault(lastVault.path, { name: lastVault.name })
	}, [recentVaults, vault, autoOpenLastVault, openVault])
}

function useNoteCacheLifecycle(flushActive: () => Promise<void>) {
	useEffect(() => {
		noteCache.start()

		const handleBeforeUnload = () => {
			void noteCache.flushAll()
			void flushActive()
		}
		window.addEventListener("beforeunload", handleBeforeUnload)

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload)
			noteCache.stop()
		}
	}, [flushActive])
}

function useVaultWorkspaceLifecycle({
	vault,
	loadWorkspace,
	startWorkspacePersistence,
	resetWorkspace,
	resetSearch,
	resetTags,
	resetBookmarks,
	loadSettings,
	loadOverrides,
	loadBookmarks,
	loadTagColors,
}: VaultWorkspaceLifecycleOptions) {
	useEffect(() => {
		if (!vault) {
			resetWorkspace()
			resetSearch()
			resetTags()
			resetBookmarks()
			return
		}
		let cancelled = false
		let stopWorkspacePersistence: (() => void) | null = null
		const vaultPath = vault.path
		loadWorkspace(vaultPath).finally(() => {
			if (cancelled) return
			stopWorkspacePersistence = startWorkspacePersistence(vaultPath)
			void loadEditorRuntime()
			openPendingOnboardingNote()
		})
		void loadSettings(vaultPath)
		void loadOverrides(vaultPath)
		void loadBookmarks(vaultPath)
		void loadTagColors(vaultPath)
		return () => {
			cancelled = true
			stopWorkspacePersistence?.()
		}
	}, [
		vault,
		loadWorkspace,
		startWorkspacePersistence,
		resetWorkspace,
		resetSearch,
		resetTags,
		resetBookmarks,
		loadSettings,
		loadOverrides,
		loadBookmarks,
		loadTagColors,
	])
}

function scheduleIdleWork(work: () => void): () => void {
	if (typeof window.requestIdleCallback === "function") {
		const idleId = window.requestIdleCallback(work, { timeout: 1500 })
		return () => window.cancelIdleCallback(idleId)
	}
	const timeoutId = window.setTimeout(work, 250)
	return () => window.clearTimeout(timeoutId)
}

function useVaultIndexing(vault: VaultMetadata | null, files: FileEntry[]) {
	const indexVault = useSearchStore((s) => s.indexVault)
	const cancelSearchIndexing = useSearchStore((s) => s.cancelIndexing)
	const buildTagIndexFromFiles = useTagsStore((s) => s.buildIndexFromFiles)
	const cancelTagIndexing = useTagsStore((s) => s.cancelIndexing)

	useEffect(() => {
		if (!vault || files.length === 0) return
		let cancelled = false
		const cancelScheduledWork = scheduleIdleWork(() => {
			if (cancelled) return
			void (async () => {
				await indexVault(vault.path, files)
				if (!cancelled) await buildTagIndexFromFiles(vault.path, files)
			})()
		})
		return () => {
			cancelled = true
			cancelSearchIndexing()
			cancelTagIndexing()
			cancelScheduledWork()
		}
	}, [vault, files, indexVault, cancelSearchIndexing, buildTagIndexFromFiles, cancelTagIndexing])
}

function useSettingsWindowBridge({
	settingsOpen,
	settingsInitialSection,
	vault,
	closeSettings,
}: SettingsWindowBridgeOptions) {
	const [settingsModalOpen, setSettingsModalOpen] = useState(false)

	useEffect(() => {
		if (!settingsOpen || !vault) {
			setSettingsModalOpen(settingsOpen && !vault)
			return
		}

		let cancelled = false
		getPlatform()
			.window.openSettings({
				section: settingsInitialSection,
				vaultPath: vault.path,
				vaultName: vault.name,
			})
			.then(() => {
				if (!cancelled) closeSettings()
			})
			.catch(() => {
				if (!cancelled) setSettingsModalOpen(true)
			})
		return () => {
			cancelled = true
		}
	}, [settingsOpen, settingsInitialSection, vault, closeSettings])

	const handleSettingsModalOpenChange = (open: boolean) => {
		if (!open) closeSettings()
	}

	return { settingsModalOpen, handleSettingsModalOpenChange }
}

function useInactiveTabSuspension(suspendInactiveTabs: () => void) {
	useEffect(() => {
		const suspensionInterval = setInterval(
			() => {
				suspendInactiveTabs()
			},
			5 * 60 * 1000,
		)

		return () => clearInterval(suspensionInterval)
	}, [suspendInactiveTabs])
}

function useGlobalDragGuards() {
	useEffect(() => {
		const preventDefaultDrag = (event: DragEvent) => {
			if (!useDragStore.getState().dragSource) return
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
		}
		const preventDefaultDrop = (event: DragEvent) => {
			if (!useDragStore.getState().dragSource) return
			event.preventDefault()
			useDragStore.getState().cancelDrag()
		}
		document.addEventListener("dragover", preventDefaultDrag)
		document.addEventListener("drop", preventDefaultDrop)
		return () => {
			document.removeEventListener("dragover", preventDefaultDrag)
			document.removeEventListener("drop", preventDefaultDrop)
		}
	}, [])
}

function useActiveSidebarView(sidebarViews: SidebarViewItem[]) {
	const leftSidebarView = useUIStore((s) => s.leftSidebarView)
	const setLeftSidebarView = useUIStore((s) => s.setLeftSidebarView)
	const activeSidebarView = getAvailableSidebarViewId(sidebarViews, leftSidebarView)

	return { activeSidebarView, leftSidebarView, setLeftSidebarView }
}

export default function App() {
	const vault = useVaultStore((s) => s.vault)
	const files = useVaultStore((s) => s.files)
	const recentVaults = useVaultStore((s) => s.recentVaults)
	const openVault = useVaultStore((s) => s.openVault)
	const loadRecentVaults = useVaultStore((s) => s.loadRecentVaults)
	const firstRunOnboardingSeen = useAppStore((s) => s.firstRunOnboardingSeen)
	const appVersion = useAppStore((s) => s.version)
	const loadAppInfo = useAppStore((s) => s.loadAppInfo)
	const loadFirstRunOnboarding = useAppStore((s) => s.loadFirstRunOnboarding)
	const markFirstRunOnboardingSeen = useAppStore((s) => s.markFirstRunOnboardingSeen)
	const flushActive = useEditorStore((s) => s.flushActive)
	const splitTree = useWorkspaceStore((s) => s.splitTree)
	const resizeSplit = useWorkspaceStore((s) => s.resizeSplit)
	const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
	const persistWorkspace = useWorkspaceStore((s) => s.persistWorkspace)
	const reset = useWorkspaceStore((s) => s.reset)
	const suspendInactiveTabs = useWorkspaceStore((s) => s.suspendInactiveTabs)
	const leftSidebarCollapsed = useUIStore((s) => s.leftSidebarCollapsed)
	const leftSidebarWidth = useUIStore((s) => s.leftSidebarWidth)
	const setLeftSidebarWidth = useUIStore((s) => s.setLeftSidebarWidth)
	const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)
	const settingsOpen = useUIStore((s) => s.settingsOpen)
	const settingsInitialSection = useUIStore((s) => s.settingsInitialSection)
	const openSettings = useUIStore((s) => s.openSettings)
	const closeSettings = useUIStore((s) => s.closeSettings)
	const appearanceSettings = useSettingsStore((s) => s.settings.appearance)
	const autoOpenLastVault = useSettingsStore((s) => s.settings.general.autoOpenLastVault)
	const loadSettings = useSettingsStore((s) => s.loadSettings)
	const loadGlobalSettings = useSettingsStore((s) => s.loadGlobalSettings)
	const loadOverrides = useHotkeysStore((s) => s.loadOverrides)
	const resetSearch = useSearchStore((s) => s.reset)
	const resetTags = useTagsStore((s) => s.reset)
	const loadTagColors = useTagsStore((s) => s.loadTagColors)
	const loadBookmarks = useBookmarksStore((s) => s.loadBookmarks)
	const resetBookmarks = useBookmarksStore((s) => s.reset)
	const startWorkspacePersistence = useWorkspacePersistence(persistWorkspace)
	const sidebarViews = useSidebarViews()
	const { activeSidebarView, leftSidebarView, setLeftSidebarView } =
		useActiveSidebarView(sidebarViews)
	const handleOpenMarketplace = useCallback(() => {
		openMarketplaceView("plugins")
	}, [])
	const { settingsModalOpen, handleSettingsModalOpenChange } = useSettingsWindowBridge({
		settingsOpen,
		settingsInitialSection,
		vault,
		closeSettings,
	})
	const { sidebarElementRef, handleSidebarResizeStart } = useSidebarResize(
		leftSidebarCollapsed,
		leftSidebarWidth,
		setLeftSidebarWidth,
	)

	useEffect(() => {
		void loadGlobalSettings()
	}, [loadGlobalSettings])

	useHotkeyListener()
	useSyncLifecycle()
	useSyncBillingDeepLink()
	useNativeNotifications()
	useCommunityPluginLifecycle(vault)
	useCommunityThemeLifecycle(vault, appearanceSettings)
	useNativeMenuEvents()
	useMarketplaceOpenEvents()
	useAppCommands()
	useAppUpdateLifecycle(appVersion, vault)
	useAppStartup(loadAppInfo, loadFirstRunOnboarding, loadRecentVaults)
	useFirstRunOnboardingMarker(
		firstRunOnboardingSeen,
		recentVaults.length,
		vault,
		markFirstRunOnboardingSeen,
	)
	useAuthSessionWatcher()
	useLastVaultAutoOpen({
		vault,
		recentVaults,
		autoOpenLastVault,
		openVault,
	})
	useNoteCacheLifecycle(flushActive)
	useVaultWorkspaceLifecycle({
		vault,
		loadWorkspace,
		startWorkspacePersistence,
		resetWorkspace: reset,
		resetSearch,
		resetTags,
		resetBookmarks,
		loadSettings,
		loadOverrides,
		loadBookmarks,
		loadTagColors,
	})
	useVaultIndexing(vault, files)
	useInactiveTabSuspension(suspendInactiveTabs)
	useGlobalDragGuards()

	const handleSidebarViewSelect = (id: string) => {
		if (id === leftSidebarView) return
		if (leftSidebarCollapsed) toggleLeftSidebar()
		setLeftSidebarView(id)
	}

	return (
		<div
			className="app-shell flex flex-col h-screen bg-bg-primary text-text-primary"
			data-native-window-effects={appearanceSettings.nativeWindowEffects ? "enabled" : "disabled"}
		>
			<AppTitlebar
				vault={vault}
				leftSidebarCollapsed={leftSidebarCollapsed}
				leftSidebarWidth={leftSidebarWidth}
				onToggleLeftSidebar={toggleLeftSidebar}
			/>
			<AppContent
				vault={vault}
				leftSidebarCollapsed={leftSidebarCollapsed}
				leftSidebarWidth={leftSidebarWidth}
				sidebarElementRef={sidebarElementRef}
				sidebarViews={sidebarViews}
				activeSidebarView={activeSidebarView}
				splitTree={splitTree}
				onSidebarViewSelect={handleSidebarViewSelect}
				onSidebarResizeStart={handleSidebarResizeStart}
				onOpenMarketplace={handleOpenMarketplace}
				onOpenSettings={() => openSettings("general")}
				onResizeSplit={resizeSplit}
			/>
			<AppOverlays
				settingsModalOpen={settingsModalOpen}
				onSettingsModalOpenChange={handleSettingsModalOpenChange}
			/>
		</div>
	)
}
