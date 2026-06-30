import type { FileTabKind, Tab } from "@cortex/core"
import { useDragStore, useEditorStore, useRemoteVaultStore, useWorkspaceStore } from "@cortex/core"
import type { CursorInfo, EditorConfig } from "@cortex/editor/types"
import { PluginViewRenderer, usePluginStore } from "@cortex/plugin-host-web"
import { useSettingsStore } from "@cortex/settings"
import { Button, Kbd, Spinner } from "@cortex/ui"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { ConflictBanner } from "../sync/ConflictBanner"
import { NoteHistoryPanel } from "../sync/NoteHistoryPanel"
import { TabBar } from "../tabs/TabBar"
import { ActiveTabEditor, type TabEditorProps } from "./ActiveTabEditor"
import { getCoreViewComponent } from "./coreViewRegistry"
import { DropZoneOverlay } from "./DropZoneOverlay"
import { PaneFallbackMenu } from "./PaneFallbackMenu"
import { usePaneTabMenu } from "./usePaneTabMenu"

const emptyTabs: Tab[] = []
const LazyPdfTabView = lazy(() =>
	import("./PdfTabView").then((module) => ({ default: module.PdfTabView })),
)

function inferFileTabKind(filePath: string): FileTabKind {
	return filePath.toLocaleLowerCase().endsWith(".pdf") ? "pdf" : "markdown"
}

function getFileTabKind(tab: Tab | null): FileTabKind | null {
	if (!tab || tab.tabType !== "file") return null
	return tab.fileKind ?? inferFileTabKind(tab.filePath)
}

function useEditorConfig(): EditorConfig {
	const editorFontSize = useSettingsStore((s) => s.settings.appearance.editorFontSize)
	const wordWrap = useSettingsStore((s) => s.settings.editor.wordWrap)
	const folding = useSettingsStore((s) => s.settings.editor.folding)
	const tabSize = useSettingsStore((s) => s.settings.editor.tabSize)
	const useSpaces = useSettingsStore((s) => s.settings.editor.useSpaces)
	const showLineNumbers = useSettingsStore((s) => s.settings.editor.showLineNumbers)
	const vimMode = useSettingsStore((s) => s.settings.editor.vimMode)

	return useMemo(
		() => ({
			fontSize: editorFontSize,
			wordWrap,
			folding,
			tabSize,
			useSpaces,
			showLineNumbers,
			vimMode,
		}),
		[editorFontSize, wordWrap, folding, tabSize, useSpaces, showLineNumbers, vimMode],
	)
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
				variant="ghost"
				className="flex-1 flex items-center justify-center text-xs text-text-muted bg-bg-primary border-none font-family-ui w-full hover:bg-bg-secondary"
				onClick={handleResume}
			>
				Tab suspended - click to resume
			</Button>
		</div>
	)
}

function TabEditor(props: TabEditorProps) {
	if (props.tab.isSuspended) return <SuspendedTabContent {...props} />
	if (getFileTabKind(props.tab) === "pdf") {
		return (
			<Suspense
				fallback={
					<div
						className="absolute inset-0 flex items-center justify-center gap-2 bg-bg-primary text-xs text-text-muted"
						style={{ display: props.isActive ? "flex" : "none" }}
						aria-hidden={!props.isActive}
					>
						<Spinner className="size-4" />
						Loading PDF viewer...
					</div>
				}
			>
				<LazyPdfTabView tab={props.tab} paneId={props.paneId} isActive={props.isActive} />
			</Suspense>
		)
	}
	return <ActiveTabEditor {...props} />
}

interface ViewTabContentProps {
	tab: Tab
	paneId: string
	isActive: boolean
}

function ViewTabContent({ tab, paneId, isActive }: ViewTabContentProps) {
	const views = usePluginStore((s) => s.views)
	const updateViewTabState = useWorkspaceStore((s) => s.updateViewTabState)
	const CoreComponent = tab.viewId ? getCoreViewComponent(tab.viewId) : null
	const pluginRegistration =
		views.find((view) => view.registrationKey === tab.viewId) ??
		views.find((view) => view.id === tab.viewId)
	const viewState = tab.viewState ?? pluginRegistration?.initialState ?? {}

	return (
		<div
			className="absolute inset-0 flex flex-col overflow-auto"
			style={{ display: isActive ? "flex" : "none" }}
			aria-hidden={!isActive}
		>
			{CoreComponent ? (
				<CoreComponent
					viewState={viewState}
					onStateChange={(nextState) => updateViewTabState(tab.id, paneId, nextState)}
					isActive={isActive}
				/>
			) : pluginRegistration ? (
				<div className="p-4">
					<PluginViewRenderer
						registration={pluginRegistration}
						state={viewState}
						onStateChange={(nextState) => updateViewTabState(tab.id, paneId, nextState)}
					/>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-text-muted">
					View not available
					<Button
						variant="ghost"
						size="sm"
						onClick={() => useWorkspaceStore.getState().closeTab(tab.id, paneId)}
					>
						Close tab
					</Button>
				</div>
			)}
		</div>
	)
}

function EmptyPaneState() {
	return (
		<div className="flex flex-col items-center justify-center gap-5 h-full text-sm text-text-muted">
			<p>No open files</p>
			<p className="flex gap-1 items-center">
				<Kbd>⌘</Kbd>
				<Kbd>n</Kbd>
				<span>New File</span>
			</p>
			<p className="flex gap-1 items-center">
				<Kbd>⌘</Kbd>
				<Kbd>o</Kbd>
				<span>Search notes</span>
			</p>
		</div>
	)
}

interface PaneContentProps {
	paneId: string
	paneTabs: Tab[]
	activeTabId: string | null
	editorConfig: EditorConfig
	onCursorChange: (cursor: CursorInfo) => void
	onViewHistory: (filePath: string) => void
}

function PaneContent({
	paneId,
	paneTabs,
	activeTabId,
	editorConfig,
	onCursorChange,
	onViewHistory,
}: PaneContentProps) {
	const dragSource = useDragStore((state) => state.dragSource)

	return (
		<div
			className="pane-content flex-1 overflow-hidden relative bg-bg-primary"
			data-drop-pane-id={paneId}
		>
			{dragSource && <DropZoneOverlay paneId={paneId} />}
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
					) : (
						<TabEditor
							key={tab.id}
							tab={tab}
							paneId={paneId}
							isActive={tab.id === activeTabId}
							editorConfig={editorConfig}
							onCursorChange={onCursorChange}
							onViewHistory={onViewHistory}
						/>
					),
				)
			)}
		</div>
	)
}

function useActivePaneFile(
	paneId: string,
	activePaneId: string,
	activeFileTab: Tab | null,
	setActiveFile: (filePath: string | null) => void,
) {
	// oxlint-disable react-doctor/no-event-handler -- active editor file follows the active pane/tab bridge
	useEffect(() => {
		if (paneId === activePaneId) setActiveFile(activeFileTab?.filePath ?? null)
	}, [paneId, activePaneId, activeFileTab, setActiveFile])
	// oxlint-enable react-doctor/no-event-handler
}

interface Props {
	paneId: string
}

export function PaneView({ paneId }: Props) {
	const pane = useWorkspaceStore((s) => s.panes[paneId] ?? null)
	const activePaneId = useWorkspaceStore((s) => s.activePaneId)
	const activateTab = useWorkspaceStore((s) => s.activateTab)
	const closeTab = useWorkspaceStore((s) => s.closeTab)
	const pinTab = useWorkspaceStore((s) => s.pinTab)
	const updateCursor = useEditorStore((s) => s.updateCursor)
	const setActiveFile = useEditorStore((s) => s.setActiveFile)
	const editorConfig = useEditorConfig()

	const paneTabs = pane?.tabs ?? emptyTabs
	const activeTabId = pane?.activeTabId ?? null
	const activeTab = activeTabId ? paneTabs.find((tab) => tab.id === activeTabId) : null
	const activeFileTab = activeTab?.tabType === "file" ? activeTab : null
	const activeMarkdownFileTab =
		getFileTabKind(activeFileTab ?? null) === "markdown" ? activeFileTab : null

	const linkedVaultId = useRemoteVaultStore((s) => s.linkedVaultId)
	const [historyFilePath, setHistoryFilePath] = useState<string | null>(null)

	const handleViewHistory = useCallback((filePath: string) => {
		setHistoryFilePath(filePath)
	}, [])
	const {
		fallbackMenu,
		fallbackTab,
		dismissFallbackMenu,
		handleCloseOthers,
		handleCloseToRight,
		handleCopyPath,
		handleReveal,
		handleOpenInRight,
		handleViewHistory: handleTabViewHistory,
		handleTabContextMenu,
	} = usePaneTabMenu({
		paneId,
		paneTabs,
		closeTab,
		pinTab,
		linkedVaultId,
		onViewHistory: handleViewHistory,
	})
	const handleCursorChange = useCallback(
		(cursor: CursorInfo) => {
			if (paneId === activePaneId) updateCursor(cursor)
		},
		[activePaneId, paneId, updateCursor],
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
	const handlePin = useCallback(
		(tabId: string) => {
			pinTab(tabId, paneId)
		},
		[pinTab, paneId],
	)
	const handleHistoryOpenChange = useCallback((open: boolean) => {
		if (!open) setHistoryFilePath(null)
	}, [])

	useActivePaneFile(paneId, activePaneId, activeMarkdownFileTab, setActiveFile)

	if (!pane) return null

	return (
		<div className="pane-view relative flex flex-col h-full overflow-hidden bg-bg-primary">
			<TabBar
				tabs={pane.tabs}
				activeTabId={activeTabId}
				paneId={paneId}
				onActivate={handleActivate}
				onClose={handleClose}
				onPin={handlePin}
				onContextMenu={handleTabContextMenu}
			/>

			{activeMarkdownFileTab && <ConflictBanner filePath={activeMarkdownFileTab.filePath} />}

			<PaneFallbackMenu
				menu={fallbackMenu}
				tab={fallbackTab}
				showVersionHistory={Boolean(linkedVaultId)}
				onDismiss={dismissFallbackMenu}
				onClose={handleClose}
				onCloseOthers={handleCloseOthers}
				onCloseToRight={handleCloseToRight}
				onPin={handlePin}
				onOpenInRight={handleOpenInRight}
				onCopyPath={handleCopyPath}
				onReveal={handleReveal}
				onViewHistory={handleTabViewHistory}
			/>

			<PaneContent
				paneId={paneId}
				paneTabs={paneTabs}
				activeTabId={activeTabId}
				editorConfig={editorConfig}
				onCursorChange={handleCursorChange}
				onViewHistory={handleViewHistory}
			/>

			<NoteHistoryPanel
				filePath={historyFilePath ?? ""}
				open={historyFilePath !== null}
				onOpenChange={handleHistoryOpenChange}
			/>
		</div>
	)
}
