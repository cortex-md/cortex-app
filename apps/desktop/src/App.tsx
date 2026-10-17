import {
	LEFT_SIDEBAR_WIDTH_BOUNDS,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { CORE_OWNER, usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { Button, SimpleTooltip, Toaster, TooltipProvider } from "@cortex/ui"
import { PanelLeftIcon, SettingsIcon } from "lucide-react"
import {
	type ComponentType,
	type CSSProperties,
	createElement,
	type FunctionComponent,
	lazy,
	memo,
	type ReactNode,
	Suspense,
	useEffect,
	useMemo,
} from "react"
import {
	authModal,
	commandPaletteModal,
	createFromTemplateModal,
	manageAccessModal,
	noteHistoryModal,
	noteShareModal,
	obsidianImportModal,
	quickFinderModal,
	resetPasswordModal,
	tagPickerModal,
} from "@/utils/modals"
import { AppLifecycle } from "./bootstrap/AppLifecycle"
import { initializeDesktopHost } from "./bootstrap/desktopHost"
import { EmbedHost } from "./features/embeds/EmbedHost"
import { SidebarViewStage } from "./features/file-explorer/SidebarViewStage"
import {
	getAvailableSidebarViewId,
	type SidebarViewItem,
	type SidebarViewPanelProps,
} from "./features/file-explorer/sidebarViewUtils"
import { EmptyVaultLayout } from "./features/layout/empty-vault-layout"
import { type SplitPaneLeafProps, SplitPaneView } from "./features/layout/SplitPane"
import { openMarketplaceView } from "./features/marketplace/openMarketplaceView"
import { PluginModalHost } from "./features/plugins/rendering/PluginModalHost"
import { PluginViewRenderer } from "./features/plugins/rendering/PluginViewRenderer"
import { RightSidebar } from "./features/right-sidebar/RightSidebar"
import { openSettings, settingsModal } from "./features/settings/settingsModal"
import { useRibbonVisible } from "./features/sidebar/ribbon"
import { SidebarRail } from "./features/sidebar/SidebarRail"
import { SidebarViewStrip } from "./features/sidebar/SidebarViewStrip"
import { DragPreview } from "./features/split-view/DragPreview"
import { PaneView } from "./features/split-view/PaneView"
import { StatusBar } from "./features/statusbar/StatusBar"
import { deletedNotesModal, syncLogsModal } from "./features/sync/syncDialogStores"
import { shareTemplateModal } from "./features/templates/shareActions"
import { newTemplateModal } from "./features/templates/templateActions"
import { VaultSwitcher } from "./features/vault/VaultSwitcher"
import { addVaultModal } from "./features/vault/vaultActions"
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

type PreloadableComponent = FunctionComponent & { preload: () => Promise<void> }

function lazyNamed<M extends Record<string, unknown>>(
	load: () => Promise<M>,
	name: keyof M,
): PreloadableComponent {
	let resolved: ComponentType | null = null
	const resolve = () =>
		load().then((module) => {
			resolved = module[name] as ComponentType
			return resolved
		})
	const Lazy = lazy(() => resolve().then((component) => ({ default: component })))
	const Preloadable: FunctionComponent = () =>
		resolved ? createElement(resolved) : createElement(Lazy)
	return Object.assign(Preloadable, { preload: () => resolve().then(() => undefined) })
}

const overlayLoaders = {
	auth: () => import("./features/auth/AuthModal"),
	createFromTemplate: () => import("./features/templates/CreateFromTemplateDialog"),
	newTemplate: () => import("./features/templates/NewTemplateDialog"),
	shareTemplate: () => import("./features/templates/ShareTemplateDialog"),
	noteHistory: () => import("./features/sync/NoteHistoryPanel"),
	noteShare: () => import("./features/sync/NoteShareDialog"),
	manageAccess: () => import("./features/sync/ManageAccessDialog"),
	resetPassword: () => import("./features/auth/ResetPasswordDialog"),
	quickFinder: () => import("./features/quick-finder/QuickFinder"),
	commandPalette: () => import("./features/command-palette/CommandPalette"),
	tagPicker: () => import("./features/tags/TagPicker"),
	syncDialogs: () => import("./features/sync/syncDialogs"),
	addVault: () => import("./features/vault/add-vault/AddVaultDialog"),
	obsidianImport: () => import("./features/import-export/ObsidianImportDialog"),
	settings: () => import("./features/settings/SettingsOverlay"),
}

const LazyAuthModal = lazyNamed(overlayLoaders.auth, "AuthModal")
const LazyCreateFromTemplateDialog = lazyNamed(
	overlayLoaders.createFromTemplate,
	"CreateFromTemplateDialog",
)
const LazyNewTemplateHost = lazyNamed(overlayLoaders.newTemplate, "NewTemplateHost")
const LazyShareTemplateHost = lazyNamed(overlayLoaders.shareTemplate, "ShareTemplateHost")
const LazyNoteHistoryHost = lazyNamed(overlayLoaders.noteHistory, "NoteHistoryHost")
const LazyNoteShareHost = lazyNamed(overlayLoaders.noteShare, "NoteShareHost")
const LazyManageAccessHost = lazyNamed(overlayLoaders.manageAccess, "ManageAccessHost")
const LazyResetPasswordHost = lazyNamed(overlayLoaders.resetPassword, "ResetPasswordHost")
const LazyQuickFinder = lazyNamed(overlayLoaders.quickFinder, "QuickFinder")
const LazyCommandPalette = lazyNamed(overlayLoaders.commandPalette, "CommandPalette")
const LazyTagPicker = lazyNamed(overlayLoaders.tagPicker, "TagPicker")
const LazySyncDialogsHost = lazyNamed(overlayLoaders.syncDialogs, "SyncDialogsHost")
const LazyAddVaultDialogHost = lazyNamed(overlayLoaders.addVault, "AddVaultDialogHost")
const LazyObsidianImportHost = lazyNamed(overlayLoaders.obsidianImport, "ObsidianImportHost")
const LazySettingsOverlayHost = lazyNamed(overlayLoaders.settings, "SettingsOverlayHost")

const overlayComponents = [
	LazyQuickFinder,
	LazyCommandPalette,
	LazyTagPicker,
	LazyAuthModal,
	LazyCreateFromTemplateDialog,
	LazyNewTemplateHost,
	LazyShareTemplateHost,
	LazyNoteHistoryHost,
	LazyNoteShareHost,
	LazyManageAccessHost,
	LazyResetPasswordHost,
	LazySyncDialogsHost,
	LazyAddVaultDialogHost,
	LazyObsidianImportHost,
	LazySettingsOverlayHost,
]

function preloadOverlays(): () => void {
	return scheduleIdleWork(() => {
		for (const component of overlayComponents) void component.preload()
	})
}

const RIBBON_WIDTH = 56

function useCollapsedSidebarWidth(): number {
	return useRibbonVisible() ? RIBBON_WIDTH : 0
}

function toggleLeftSidebar() {
	useUIStore.getState().toggleLeftSidebar()
}

function openGeneralSettings() {
	openSettings("general")
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
	const collapsedWidth = useCollapsedSidebarWidth()
	const sidebarWidth = leftSidebarCollapsed ? collapsedWidth : leftSidebarWidth
	const titlebarStyle = {
		"--app-titlebar-drag-width": `${sidebarWidth}px`,
		"--app-sidebar-width": `${sidebarWidth}px`,
	} as CSSProperties

	return (
		<div className="app-titlebar h-[var(--titlebar-height)] flex-shrink-0" style={titlebarStyle}>
			<div className="app-titlebar-drag-region" aria-hidden="true" />
			{hasVault && (
				<SimpleTooltip label={leftSidebarCollapsed ? "Show sidebar" : "Hide sidebar"} side="bottom">
					<Button
						type="button"
						variant="secondary"
						size="icon-sm"
						className={`app-sidebar-toggle ${
							leftSidebarCollapsed ? "app-sidebar-toggle--collapsed" : ""
						}`}
						aria-label={leftSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
						aria-pressed={!leftSidebarCollapsed}
						onClick={toggleLeftSidebar}
					>
						<PanelLeftIcon size={17} strokeWidth={2} />
					</Button>
				</SimpleTooltip>
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
	const showRibbon = useRibbonVisible()
	const activeSidebarView = getAvailableSidebarViewId(sidebarViews, leftSidebarView)

	return (
		<div className="sidebar-body">
			{showRibbon && (
				<SidebarRail
					items={sidebarViews}
					activeId={activeSidebarView}
					collapsed={leftSidebarCollapsed}
					onSelect={selectSidebarView}
					onOpenMarketplace={openPluginMarketplace}
					onOpenSettings={openGeneralSettings}
				/>
			)}
			<div className="sidebar-panel" inert={leftSidebarCollapsed}>
				<div className="sidebar-panel-top">
					<VaultSwitcher />
					{!showRibbon && (
						<SimpleTooltip label="Settings" side="bottom">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="sidebar-panel-top-action"
								aria-label="Settings"
								onClick={openGeneralSettings}
							>
								<SettingsIcon size={16} strokeWidth={2} />
							</Button>
						</SimpleTooltip>
					)}
				</div>
				{!showRibbon && (
					<SidebarViewStrip
						items={sidebarViews}
						activeId={activeSidebarView}
						onSelect={selectSidebarView}
					/>
				)}
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
	const collapsedWidth = useCollapsedSidebarWidth()
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
				} ${collapsedWidth === 0 ? "app-sidebar--no-ribbon" : ""}`}
				style={{
					width: leftSidebarCollapsed ? collapsedWidth : leftSidebarWidth,
					minWidth: leftSidebarCollapsed ? collapsedWidth : LEFT_SIDEBAR_WIDTH_BOUNDS.min,
					maxWidth: leftSidebarCollapsed ? collapsedWidth : LEFT_SIDEBAR_WIDTH_BOUNDS.max,
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
	const showRibbon = useRibbonVisible()

	return (
		<main
			className="app-main flex-1 overflow-hidden flex flex-col min-w-0"
			data-left-sidebar-collapsed={leftSidebarCollapsed ? "true" : undefined}
			data-ribbon={showRibbon ? undefined : "hidden"}
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
	const authOpen = authModal.useTarget() !== null
	const createFromTemplateOpen = createFromTemplateModal.useTarget() !== null
	const quickFinderOpen = quickFinderModal.useTarget() !== null
	const commandPaletteOpen = commandPaletteModal.useTarget() !== null
	const tagPickerOpen = tagPickerModal.useTarget() !== null
	const noteHistoryOpen = noteHistoryModal.useTarget() !== null
	const noteShareOpen = noteShareModal.useTarget() !== null
	const manageAccessOpen = manageAccessModal.useTarget() !== null
	const resetPasswordOpen = resetPasswordModal.useTarget() !== null
	const syncLogsOpen = syncLogsModal.useTarget() !== null
	const deletedNotesOpen = deletedNotesModal.useTarget() !== null
	const addVaultOpen = addVaultModal.useTarget() !== null
	const newTemplateOpen = newTemplateModal.useTarget() !== null
	const shareTemplateOpen = shareTemplateModal.useTarget() !== null
	const obsidianImportOpen = obsidianImportModal.useTarget() !== null
	const settingsOpen = settingsModal.useTarget() !== null

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
			<DeferredOverlay open={newTemplateOpen}>
				<LazyNewTemplateHost />
			</DeferredOverlay>
			<DeferredOverlay open={shareTemplateOpen}>
				<LazyShareTemplateHost />
			</DeferredOverlay>
			<EmbedHost />
			<Toaster />
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
			<DeferredOverlay open={addVaultOpen}>
				<LazyAddVaultDialogHost />
			</DeferredOverlay>
			<DeferredOverlay open={obsidianImportOpen}>
				<LazyObsidianImportHost />
			</DeferredOverlay>
			<DeferredOverlay open={settingsOpen}>
				<LazySettingsOverlayHost />
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
		<TooltipProvider delayDuration={400} skipDelayDuration={200}>
			<div
				className="app-shell flex flex-col h-screen bg-bg-primary text-text-primary"
				data-native-window-effects={nativeWindowEffects && hasVault ? "enabled" : "disabled"}
			>
				<AppLifecycle />
				<AppContent hasVault={hasVault} />
				<AppTitlebar hasVault={hasVault} />
				<AppOverlays />
				<MainWindowReady />
			</div>
		</TooltipProvider>
	)
}
