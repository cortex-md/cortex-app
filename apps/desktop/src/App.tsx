import {
	LEFT_SIDEBAR_WIDTH_BOUNDS,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { CORE_OWNER, usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { Button } from "@cortex/ui"
import { PanelLeftIcon } from "lucide-react"
import {
	type ComponentType,
	type CSSProperties,
	lazy,
	memo,
	type ReactNode,
	Suspense,
	useEffect,
	useMemo,
} from "react"
import { AppLifecycle } from "./bootstrap/AppLifecycle"
import { initializeDesktopHost } from "./bootstrap/desktopHost"
import { resetPasswordModal } from "./features/auth/resetPasswordModal"
import { newDatabaseModal } from "./features/databases/newDatabaseModal"
import { EmbedHost } from "./features/embeds/EmbedHost"
import { SidebarViewStage } from "./features/file-explorer/SidebarViewStage"
import {
	getAvailableSidebarViewId,
	type SidebarViewItem,
	type SidebarViewPanelProps,
} from "./features/file-explorer/sidebarViewUtils"
import { obsidianImportModal } from "./features/import-export/obsidianImportModal"
import { EmptyVaultLayout } from "./features/layout/empty-vault-layout"
import { type SplitPaneLeafProps, SplitPaneView } from "./features/layout/SplitPane"
import { openMarketplaceView } from "./features/marketplace/openMarketplaceView"
import { PluginModalHost } from "./features/plugins/rendering/PluginModalHost"
import { PluginViewRenderer } from "./features/plugins/rendering/PluginViewRenderer"
import { RightSidebar } from "./features/right-sidebar/RightSidebar"
import { SidebarRail } from "./features/sidebar/SidebarRail"
import { DragPreview } from "./features/split-view/DragPreview"
import { PaneView } from "./features/split-view/PaneView"
import { StatusBar } from "./features/statusbar/StatusBar"
import { manageAccessModal } from "./features/sync/manageAccessModal"
import { noteHistoryModal } from "./features/sync/noteHistoryModal"
import { noteShareModal } from "./features/sync/noteShareModal"
import { deletedNotesModal, syncLogsModal } from "./features/sync/syncDialogStores"
import { createVaultModal } from "./features/vault/createVaultModalStore"
import { VaultSwitcher } from "./features/vault/VaultSwitcher"
import { useHasOpened } from "./hooks/useHasOpened"
import { useSidebarResize } from "./hooks/useSidebarResize"
import { scheduleIdleWork } from "./utils/scheduleIdleWork"

initializeDesktopHost()

interface AppShellProps {
	hasVault: boolean
}

interface DeferredOverlayProps {
	open: boolean
	children: ReactNode
}

function lazyNamed<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
	return lazy(() => load().then((module) => ({ default: module[name] as ComponentType })))
}

const overlayLoaders = {
	auth: () => import("./features/auth/AuthModal"),
	createFromTemplate: () => import("./features/templates/CreateFromTemplateDialog"),
	noteHistory: () => import("./features/sync/NoteHistoryPanel"),
	noteShare: () => import("./features/sync/NoteShareDialog"),
	manageAccess: () => import("./features/sync/ManageAccessDialog"),
	resetPassword: () => import("./features/auth/ResetPasswordDialog"),
	quickFinder: () => import("./features/quick-finder/QuickFinder"),
	commandPalette: () => import("./features/command-palette/CommandPalette"),
	tagPicker: () => import("./features/tags/TagPicker"),
	syncDialogs: () => import("./features/sync/syncDialogs"),
	createVault: () => import("./features/vault/CreateVaultModal"),
	newDatabase: () => import("./features/databases/NewDatabaseDialog"),
	obsidianImport: () => import("./features/import-export/ObsidianImportDialog"),
}

const LazyAuthModal = lazyNamed(overlayLoaders.auth, "AuthModal")
const LazyCreateFromTemplateDialog = lazyNamed(
	overlayLoaders.createFromTemplate,
	"CreateFromTemplateDialog",
)
const LazyNoteHistoryHost = lazyNamed(overlayLoaders.noteHistory, "NoteHistoryHost")
const LazyNoteShareHost = lazyNamed(overlayLoaders.noteShare, "NoteShareHost")
const LazyManageAccessHost = lazyNamed(overlayLoaders.manageAccess, "ManageAccessHost")
const LazyResetPasswordHost = lazyNamed(overlayLoaders.resetPassword, "ResetPasswordHost")
const LazyQuickFinder = lazyNamed(overlayLoaders.quickFinder, "QuickFinder")
const LazyCommandPalette = lazyNamed(overlayLoaders.commandPalette, "CommandPalette")
const LazyTagPicker = lazyNamed(overlayLoaders.tagPicker, "TagPicker")
const LazySyncDialogsHost = lazyNamed(overlayLoaders.syncDialogs, "SyncDialogsHost")
const LazyCreateVaultModalHost = lazyNamed(overlayLoaders.createVault, "CreateVaultModalHost")
const LazyNewDatabaseHost = lazyNamed(overlayLoaders.newDatabase, "NewDatabaseHost")
const LazyObsidianImportHost = lazyNamed(overlayLoaders.obsidianImport, "ObsidianImportHost")

function preloadOverlays(): () => void {
	return scheduleIdleWork(() => {
		for (const load of Object.values(overlayLoaders)) void load()
	})
}

const COLLAPSED_SIDEBAR_WIDTH = 56

function toggleLeftSidebar() {
	useUIStore.getState().toggleLeftSidebar()
}

function openGeneralSettings() {
	useUIStore.getState().openSettings("general")
}

function openPluginMarketplace() {
	openMarketplaceView("plugins")
}

function resizeSplit(nodeId: string, sizes: number[]) {
	useWorkspaceStore.getState().resizeSplit(nodeId, sizes)
}

function selectSidebarView(id: string) {
	const ui = useUIStore.getState()
	if (ui.leftSidebarCollapsed) ui.toggleLeftSidebar()
	if (id !== ui.leftSidebarView) ui.setLeftSidebarView(id)
}

function SidebarViewPanel({ id }: SidebarViewPanelProps) {
	const view = usePluginStore((s) => {
		const sidebarItem = s.sidebarItems.find((item) => item.key === id)
		return s.views.find((candidate) => candidate.key === sidebarItem?.viewKey)
	})

	if (!view) return null
	if (view.component) {
		const ViewComponent = view.component as ComponentType
		return <ViewComponent />
	}
	return (
		<div className="h-full min-h-0 overflow-hidden">
			<PluginViewRenderer registration={view} />
		</div>
	)
}

function SplitPaneLeaf({ paneId }: SplitPaneLeafProps) {
	return <PaneView paneId={paneId} />
}

const AppTitlebar = memo(function AppTitlebar({ hasVault }: AppShellProps) {
	const leftSidebarCollapsed = useUIStore((s) => s.leftSidebarCollapsed)
	const leftSidebarWidth = useUIStore((s) => s.leftSidebarWidth)
	const titlebarStyle = {
		"--app-titlebar-drag-width": `${leftSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : leftSidebarWidth}px`,
		"--app-sidebar-width": `${leftSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : leftSidebarWidth}px`,
	} as CSSProperties

	return (
		<div className="app-titlebar h-10 flex-shrink-0" style={titlebarStyle}>
			<div className="app-titlebar-drag-region" aria-hidden="true" />
			{hasVault && (
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
					onClick={toggleLeftSidebar}
				>
					<PanelLeftIcon size={16} strokeWidth={2} />
				</Button>
			)}
		</div>
	)
})

const AppContent = memo(function AppContent({ hasVault }: AppShellProps) {
	return (
		<div className="app-content flex flex-1 overflow-hidden">
			{hasVault ? (
				<>
					<SidebarShell />
					<WorkspaceShell />
				</>
			) : (
				<EmptyVaultLayout />
			)}
		</div>
	)
})

const SidebarViews = memo(function SidebarViews() {
	const sidebarViews = useSidebarViews()
	const leftSidebarView = useUIStore((s) => s.leftSidebarView)
	const leftSidebarCollapsed = useUIStore((s) => s.leftSidebarCollapsed)
	const activeSidebarView = getAvailableSidebarViewId(sidebarViews, leftSidebarView)

	return (
		<div className="sidebar-body">
			<SidebarRail
				items={sidebarViews}
				activeId={activeSidebarView}
				collapsed={leftSidebarCollapsed}
				onSelect={selectSidebarView}
				onOpenMarketplace={openPluginMarketplace}
				onOpenSettings={openGeneralSettings}
			/>
			<div className="sidebar-panel" inert={leftSidebarCollapsed}>
				<VaultSwitcher />
				<div className="min-h-0 flex-1 overflow-hidden">
					<SidebarViewStage
						activeId={activeSidebarView}
						items={sidebarViews}
						ViewComponent={SidebarViewPanel}
					/>
				</div>
			</div>
		</div>
	)
})

function SidebarShell() {
	const leftSidebarCollapsed = useUIStore((s) => s.leftSidebarCollapsed)
	const leftSidebarWidth = useUIStore((s) => s.leftSidebarWidth)
	const setLeftSidebarWidth = useUIStore((s) => s.setLeftSidebarWidth)
	const { sidebarElementRef, handleSidebarResizeStart } = useSidebarResize(
		leftSidebarCollapsed,
		leftSidebarWidth,
		setLeftSidebarWidth,
	)

	return (
		<>
			<aside
				ref={sidebarElementRef}
				className={`app-sidebar flex-shrink-0 flex flex-col overflow-hidden ${
					leftSidebarCollapsed ? "app-sidebar--collapsed" : ""
				}`}
				style={{
					width: leftSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : leftSidebarWidth,
					minWidth: leftSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : LEFT_SIDEBAR_WIDTH_BOUNDS.min,
					maxWidth: leftSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : LEFT_SIDEBAR_WIDTH_BOUNDS.max,
				}}
				aria-label="Sidebar panel"
			>
				<SidebarViews />
			</aside>
			<div
				className={`app-sidebar-resizer w-[3px] flex-shrink-0 cursor-col-resize bg-transparent hover:bg-accent transition-colors duration-150 ${
					leftSidebarCollapsed ? "app-sidebar-resizer--hidden" : ""
				}`}
				onPointerDown={handleSidebarResizeStart}
				aria-hidden="true"
			/>
		</>
	)
}

function WorkspaceShell() {
	const leftSidebarCollapsed = useUIStore((s) => s.leftSidebarCollapsed)
	const splitTree = useWorkspaceStore((s) => s.splitTree)

	return (
		<main
			className="app-main flex-1 overflow-hidden flex flex-col min-w-0"
			data-left-sidebar-collapsed={leftSidebarCollapsed ? "true" : undefined}
		>
			<div className="workspace-body">
				<div className="workspace-split">
					<SplitPaneView node={splitTree} LeafComponent={SplitPaneLeaf} onResize={resizeSplit} />
				</div>
				<RightSidebar />
			</div>
			<StatusBar />
		</main>
	)
}

function DeferredOverlay({ open, children }: DeferredOverlayProps) {
	const mounted = useHasOpened(open)
	if (!mounted) return null
	return <Suspense fallback={null}>{children}</Suspense>
}

const AppOverlays = memo(function AppOverlays() {
	const authOpen = useUIStore((s) => s.authOpen)
	const createFromTemplateOpen = useUIStore((s) => s.createFromTemplateOpen)
	const quickFinderOpen = useUIStore((s) => s.quickFinderOpen)
	const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
	const tagPickerOpen = useUIStore((s) => s.tagPickerOpen)
	const noteHistoryOpen = noteHistoryModal.useTarget() !== null
	const noteShareOpen = noteShareModal.useTarget() !== null
	const manageAccessOpen = manageAccessModal.useTarget() !== null
	const resetPasswordOpen = resetPasswordModal.useTarget() !== null
	const syncLogsOpen = syncLogsModal.useTarget() !== null
	const deletedNotesOpen = deletedNotesModal.useTarget() !== null
	const createVaultOpen = createVaultModal.useTarget() !== null
	const newDatabaseOpen = newDatabaseModal.useTarget() !== null
	const obsidianImportOpen = obsidianImportModal.useTarget() !== null

	useEffect(preloadOverlays, [])

	return (
		<>
			<DeferredOverlay open={authOpen}>
				<LazyAuthModal />
			</DeferredOverlay>
			<DeferredOverlay open={quickFinderOpen}>
				<LazyQuickFinder />
			</DeferredOverlay>
			<DeferredOverlay open={commandPaletteOpen}>
				<LazyCommandPalette />
			</DeferredOverlay>
			<DeferredOverlay open={tagPickerOpen}>
				<LazyTagPicker />
			</DeferredOverlay>
			<DeferredOverlay open={createFromTemplateOpen}>
				<LazyCreateFromTemplateDialog />
			</DeferredOverlay>
			<EmbedHost />
			<DeferredOverlay open={noteHistoryOpen}>
				<LazyNoteHistoryHost />
			</DeferredOverlay>
			<DeferredOverlay open={noteShareOpen}>
				<LazyNoteShareHost />
			</DeferredOverlay>
			<DeferredOverlay open={manageAccessOpen}>
				<LazyManageAccessHost />
			</DeferredOverlay>
			<DeferredOverlay open={resetPasswordOpen}>
				<LazyResetPasswordHost />
			</DeferredOverlay>
			<DeferredOverlay open={syncLogsOpen || deletedNotesOpen}>
				<LazySyncDialogsHost />
			</DeferredOverlay>
			<DeferredOverlay open={createVaultOpen}>
				<LazyCreateVaultModalHost />
			</DeferredOverlay>
			<DeferredOverlay open={newDatabaseOpen}>
				<LazyNewDatabaseHost />
			</DeferredOverlay>
			<DeferredOverlay open={obsidianImportOpen}>
				<LazyObsidianImportHost />
			</DeferredOverlay>
			<PluginModalHost />
			<DragPreview />
		</>
	)
})

function useSidebarViews(): SidebarViewItem[] {
	const sidebarItems = usePluginStore((s) => s.sidebarItems)
	const views = usePluginStore((s) => s.views)

	return useMemo<SidebarViewItem[]>(() => {
		const sidebarViewKeys = new Set(
			views.flatMap((view) => (view.location === "sidebar-left" ? [view.key] : [])),
		)
		return sidebarItems.flatMap((item) => {
			if (!sidebarViewKeys.has(item.viewKey)) return []
			const isCore = item.owner === CORE_OWNER
			return [
				{
					id: item.key,
					viewId: isCore ? undefined : item.viewKey,
					icon: item.icon as SidebarViewItem["icon"],
					label: item.label,
					source: isCore ? "core" : "extension",
				},
			]
		})
	}, [sidebarItems, views])
}

function MainWindowReady() {
	useEffect(() => {
		void getPlatform().window.markReady()
	}, [])
	return null
}

export default function App() {
	const hasVault = useVaultStore((s) => s.vault !== null)
	const nativeWindowEffects = useSettingsStore((s) => s.settings.appearance.nativeWindowEffects)

	return (
		<div
			className="app-shell flex flex-col h-screen bg-bg-primary text-text-primary"
			data-native-window-effects={nativeWindowEffects ? "enabled" : "disabled"}
		>
			<AppLifecycle />
			<AppContent hasVault={hasVault} />
			<AppTitlebar hasVault={hasVault} />
			<AppOverlays />
			<MainWindowReady />
		</div>
	)
}
