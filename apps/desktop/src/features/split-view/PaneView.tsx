import type { FileTabKind, Tab, ViewTabState } from "@cortex/core"
import { inferFileTabKind, useDragStore, useEditorStore, useWorkspaceStore } from "@cortex/core"
import type { CursorInfo, EditorConfig } from "@cortex/editor/types"
import { usePluginStore } from "@cortex/plugin-host-core"
import { Button, Kbd, Spinner } from "@cortex/ui"
import {
	type ComponentType,
	lazy,
	type MouseEvent,
	memo,
	Suspense,
	useCallback,
	useMemo,
} from "react"
import { useCommandHotkey } from "../../hooks/useCommandHotkey"
import { useContextMenu } from "../context-menu/useContextMenu"
import { PluginViewRenderer } from "../plugins/rendering/PluginViewRenderer"
import { ConflictBanner } from "../sync/ConflictBanner"
import { TabBar } from "../tabs/TabBar"
import { ActiveTabEditor, type TabEditorProps } from "./ActiveTabEditor"
import type { CoreViewProps } from "./coreViewProps"
import { DropZoneOverlay } from "./DropZoneOverlay"
import { useEditorConfig } from "./noteEditorAssets"
import { buildTabMenuItems } from "./tabMenu"

const emptyTabs: Tab[] = []
const EMPTY_VIEW_STATE: ViewTabState = {}
const MAX_MOUNTED_INACTIVE_FILE_TABS = 3
const LazyPdfTabView = lazy(() =>
	import("./PdfTabView").then((module) => ({ default: module.PdfTabView })),
)

function getMountedFileTabIds(tabs: readonly Tab[], activeTabId: string | null): Set<string> {
	const mountedTabIds = new Set<string>()
	if (activeTabId) mountedTabIds.add(activeTabId)
	const recentFileTabs = tabs
		.filter((tab) => tab.tabType === "file" && !tab.isSuspended && tab.id !== activeTabId)
		.sort((left, right) => right.lastAccessed - left.lastAccessed)
		.slice(0, MAX_MOUNTED_INACTIVE_FILE_TABS)
	for (const tab of recentFileTabs) mountedTabIds.add(tab.id)
	return mountedTabIds
}

function TabLoadingState({ isActive, label }: { isActive: boolean; label: string }) {
	return (
		<div
			className="absolute inset-0 flex items-center justify-center gap-2 bg-bg-primary text-xs text-text-muted"
			style={{ display: isActive ? "flex" : "none" }}
			aria-hidden={!isActive}
		>
			<Spinner className="size-4" />
			{label}
		</div>
	)
}

function getFileTabKind(tab: Tab | null): FileTabKind | null {
	if (!tab || tab.tabType !== "file") return null
	return tab.fileKind ?? inferFileTabKind(tab.filePath)
}

function SuspendedTabContent({ tab, paneId, isActive }: TabEditorProps) {
	const activateTab = useWorkspaceStore((s) => s.activateTab)
	const handleResume = useCallback(() => {
		activateTab(tab.id, paneId)
	}, [activateTab, paneId, tab.id])

	return (
		<div
			className="absolute inset-0 flex flex-col"
			style={{ display: isActive ? "flex" : "none" }}
			aria-hidden={!isActive}
		>
			<Button
				size="sm"
				variant="ghost"
				className="flex-1 flex items-center justify-center text-xs text-text-muted bg-bg-primary border-none font-family-ui w-full hover:bg-bg-secondary"
				onClick={handleResume}
			>
				Tab suspended - click to resume
			</Button>
		</div>
	)
}

const TabEditor = memo(function TabEditor(props: TabEditorProps) {
	if (props.tab.isSuspended) return <SuspendedTabContent {...props} />
	if (getFileTabKind(props.tab) === "pdf") {
		return (
			<Suspense
				fallback={<TabLoadingState isActive={props.isActive} label="Loading PDF viewer..." />}
			>
				<LazyPdfTabView tab={props.tab} paneId={props.paneId} isActive={props.isActive} />
			</Suspense>
		)
	}
	return <ActiveTabEditor {...props} />
})

interface ViewTabContentProps {
	tab: Tab
	paneId: string
	isActive: boolean
}

const ViewTabContent = memo(function ViewTabContent({
	tab,
	paneId,
	isActive,
}: ViewTabContentProps) {
	const registration = usePluginStore((s) => s.views.find((view) => view.key === tab.viewId))
	const updateViewTabState = useWorkspaceStore((s) => s.updateViewTabState)
	const CoreComponent = registration?.component as ComponentType<CoreViewProps> | undefined
	const pluginRegistration = CoreComponent ? undefined : registration
	const viewState = tab.viewState ?? registration?.initialState ?? EMPTY_VIEW_STATE
	const tabId = tab.id
	const handleStateChange = useCallback(
		(nextState: ViewTabState) => updateViewTabState(tabId, paneId, nextState),
		[updateViewTabState, tabId, paneId],
	)

	return (
		<div
			className="absolute inset-0 flex flex-col overflow-auto"
			style={{ display: isActive ? "flex" : "none" }}
			aria-hidden={!isActive}
		>
			{CoreComponent ? (
				<Suspense fallback={<TabLoadingState isActive={isActive} label="Loading view..." />}>
					<CoreComponent
						viewState={viewState}
						onStateChange={handleStateChange}
						isActive={isActive}
					/>
				</Suspense>
			) : pluginRegistration ? (
				<div className="p-4">
					<PluginViewRenderer
						registration={pluginRegistration}
						state={viewState}
						onStateChange={handleStateChange}
					/>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-text-muted">
					View not available
					<Button
						variant="ghost"
						onClick={() => useWorkspaceStore.getState().closeTab(tab.id, paneId)}
					>
						Close tab
					</Button>
				</div>
			)}
		</div>
	)
})

function EmptyPaneHint({ commandId, label }: { commandId: string; label: string }) {
	const hotkey = useCommandHotkey(commandId)
	if (!hotkey) return null
	return (
		<p className="flex gap-1 items-center">
			<Kbd>{hotkey}</Kbd>
			<span>{label}</span>
		</p>
	)
}

function EmptyPaneState() {
	return (
		<div className="flex flex-col items-center justify-center gap-5 h-full text-sm text-text-muted">
			<p>No open files</p>
			<EmptyPaneHint commandId="file.new" label="New File" />
			<EmptyPaneHint commandId="navigate.quick-finder" label="Search notes" />
		</div>
	)
}

interface PaneContentProps {
	paneId: string
	paneTabs: Tab[]
	activeTabId: string | null
	editorConfig: EditorConfig
	onCursorChange: (cursor: CursorInfo) => void
}

function PaneContent({
	paneId,
	paneTabs,
	activeTabId,
	editorConfig,
	onCursorChange,
}: PaneContentProps) {
	const isDragging = useDragStore((state) => state.dragSource !== null)
	const mountedFileTabIds = useMemo(
		() => getMountedFileTabIds(paneTabs, activeTabId),
		[paneTabs, activeTabId],
	)

	return (
		<div className="pane-content flex-1 overflow-hidden relative" data-drop-pane-id={paneId}>
			{isDragging && <DropZoneOverlay paneId={paneId} />}
			{paneTabs.length === 0 ? (
				<EmptyPaneState />
			) : (
				paneTabs.map((tab) =>
					tab.tabType === "view" ? (
						<ViewTabContent
							key={tab.id}
							tab={tab}
							paneId={paneId}
							isActive={tab.id === activeTabId}
						/>
					) : !mountedFileTabIds.has(tab.id) ? null : (
						<TabEditor
							key={tab.id}
							tab={tab}
							paneId={paneId}
							isActive={tab.id === activeTabId}
							editorConfig={editorConfig}
							onCursorChange={onCursorChange}
						/>
					),
				)
			)}
		</div>
	)
}

interface Props {
	paneId: string
}

export function PaneView({ paneId }: Props) {
	const pane = useWorkspaceStore((s) => s.panes[paneId] ?? null)
	const activateTab = useWorkspaceStore((s) => s.activateTab)
	const closeTab = useWorkspaceStore((s) => s.closeTab)
	const updateCursor = useEditorStore((s) => s.updateCursor)
	const editorConfig = useEditorConfig()

	const paneTabs = pane?.tabs ?? emptyTabs
	const activeTabId = pane?.activeTabId ?? null
	const activeTab = activeTabId ? paneTabs.find((tab) => tab.id === activeTabId) : null
	const activeFileTab = activeTab?.tabType === "file" ? activeTab : null
	const activeMarkdownFileTab =
		getFileTabKind(activeFileTab ?? null) === "markdown" ? activeFileTab : null

	const { showMenu, menu } = useContextMenu()
	const handleTabContextMenu = useCallback(
		(tabId: string, event: MouseEvent) => {
			event.preventDefault()
			const tab = useWorkspaceStore
				.getState()
				.panes[paneId]?.tabs.find((entry) => entry.id === tabId)
			if (tab) showMenu(buildTabMenuItems(tab, paneId), { x: event.clientX, y: event.clientY })
		},
		[paneId, showMenu],
	)
	const handleCursorChange = useCallback(
		(cursor: CursorInfo) => {
			if (useWorkspaceStore.getState().activePaneId === paneId) updateCursor(cursor)
		},
		[paneId, updateCursor],
	)
	const handleActivate = useCallback(
		(tabId: string) => {
			activateTab(tabId, paneId)
		},
		[activateTab, paneId],
	)
	const handleClose = useCallback(
		(tabId: string) => {
			closeTab(tabId, paneId)
		},
		[closeTab, paneId],
	)
	if (!pane) return null

	return (
		<div className="pane-view relative flex flex-col h-full overflow-hidden">
			<TabBar
				tabs={pane.tabs}
				activeTabId={activeTabId}
				paneId={paneId}
				onActivate={handleActivate}
				onClose={handleClose}
				onContextMenu={handleTabContextMenu}
			/>

			{activeMarkdownFileTab && <ConflictBanner filePath={activeMarkdownFileTab.filePath} />}

			{menu}

			<PaneContent
				paneId={paneId}
				paneTabs={paneTabs}
				activeTabId={activeTabId}
				editorConfig={editorConfig}
				onCursorChange={handleCursorChange}
			/>
		</div>
	)
}
