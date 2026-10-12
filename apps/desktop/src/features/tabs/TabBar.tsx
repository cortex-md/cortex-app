import { executeCommand } from "@cortex/commands"
import {
	canStepNavigationHistory,
	formatRelativeTime,
	getFileModifiedTimes,
	useDragStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	FileTextIcon,
	PanelRightIcon,
	PlusIcon,
	Table2Icon,
	XIcon,
} from "lucide-react"
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { DATABASE_VIEW_ID } from "../databases/databaseWorkspace"
import { getSidebarNotePresentation } from "../sidebar/sidebarNotePresentation"
import { useInternalDragSource } from "../split-view/useInternalDragSource"
import { getVisibleTabIds } from "./tabOverflow"

export interface TabItem {
	id: string
	title: string
	isPinned: boolean
	filePath?: string
	viewId?: string | null
	lastAccessed?: number
}

interface Props {
	tabs: TabItem[]
	activeTabId: string | null
	paneId: string
	onActivate: (tabId: string) => void
	onClose: (tabId: string) => void
	onContextMenu?: (tabId: string, event: React.MouseEvent) => void
}

interface TabBarItemProps {
	tab: TabItem
	paneId: string
	isActive: boolean
	isDragged: boolean
	tabIndex: number
	onActivate: (tabId: string) => void
	onClose: (tabId: string) => void
	onContextMenu?: (tabId: string, event: React.MouseEvent) => void
	onDragEnd: () => void
	onDragStart: (tabId: string) => void
}

function TabTooltipBody({ tab }: { tab: TabItem }) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const modifiedAt = useVaultStore((state) =>
		tab.filePath ? getFileModifiedTimes(state.files).get(tab.filePath) : undefined,
	)
	const folder = tab.filePath ? getSidebarNotePresentation(tab.filePath, vaultPath).folder : ""
	const edited = modifiedAt ? `edited ${formatRelativeTime(modifiedAt)}` : ""
	const meta = [folder, edited].filter(Boolean).join(" · ")
	return (
		<>
			<b>{tab.title}</b>
			{meta && <span>{meta}</span>}
		</>
	)
}

function useTabInsertMarker(paneId: string, tabId: string): "before" | "after" | null {
	return useDragStore((state) => {
		const dropTarget = state.dropTarget
		return dropTarget?.type === "tab" && dropTarget.paneId === paneId && dropTarget.tabId === tabId
			? (dropTarget.tabPosition ?? null)
			: null
	})
}

const TabBarItem = memo(function TabBarItem({
	tab,
	paneId,
	isActive,
	isDragged,
	tabIndex,
	onActivate,
	onClose,
	onContextMenu,
	onDragEnd,
	onDragStart,
}: TabBarItemProps) {
	const insertMarker = useTabInsertMarker(paneId, tab.id)
	const dragProps = useInternalDragSource(
		() => ({
			type: "tab",
			tabId: tab.id,
			sourcePaneId: paneId,
		}),
		{
			onDragEnd,
			onDragStart: () => onDragStart(tab.id),
		},
	)

	// oxlint-disable react-doctor/prefer-tag-over-role -- close affordance is inside TabsTrigger; nesting a real button would be invalid HTML
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<TabsTrigger
					value={tab.id}
					role="tab"
					tabIndex={isActive ? 0 : -1}
					aria-selected={isActive}
					className={`tab-trigger group/tab ${tab.isPinned ? "tab-pinned" : ""} ${
						isDragged ? "tab-trigger--dragging" : ""
					}`}
					data-drop-tab-id={tab.id}
					data-drop-tab-index={tabIndex}
					data-drop-tab-pane-id={paneId}
					{...dragProps}
					onClick={() => onActivate(tab.id)}
					onKeyDown={(e) => e.key === "Enter" && onActivate(tab.id)}
					onContextMenu={(e) => onContextMenu?.(tab.id, e)}
				>
					{insertMarker && <span className={`tab-drop-marker tab-drop-marker--${insertMarker}`} />}
					{tab.viewId === DATABASE_VIEW_ID && (
						<Table2Icon className="tab-database-icon" aria-hidden="true" />
					)}
					<span className="tab-title">{tab.title}</span>
					{!tab.isPinned && (
						// biome-ignore lint/a11y/useSemanticElements: TabsTrigger already renders the tab button; a nested button would be invalid HTML
						<span
							role="button"
							tabIndex={-1}
							aria-label={`Close ${tab.title}`}
							className="tab-close-btn"
							data-active={isActive || undefined}
							onClick={(e) => {
								e.stopPropagation()
								onClose(tab.id)
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.stopPropagation()
									onClose(tab.id)
								}
							}}
							onPointerDown={(e) => e.stopPropagation()}
						>
							<XIcon size={12} />
						</span>
					)}
				</TabsTrigger>
			</TooltipTrigger>
			<TooltipContent side="bottom" align="start" sideOffset={10} className="tab-tooltip">
				<TabTooltipBody tab={tab} />
			</TooltipContent>
		</Tooltip>
	)
	// oxlint-enable react-doctor/prefer-tag-over-role
})

function TabNavigationButtons({ paneId }: { paneId: string }) {
	const history = useWorkspaceStore((state) => state.navigation[paneId])
	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				className="tab-bar-nav"
				aria-label="Back"
				disabled={!canStepNavigationHistory(history, -1)}
				onClick={() => executeCommand("navigate.back", { source: "menu", payload: { paneId } })}
			>
				<ChevronLeftIcon />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="tab-bar-nav"
				aria-label="Forward"
				disabled={!canStepNavigationHistory(history, 1)}
				onClick={() => executeCommand("navigate.forward", { source: "menu", payload: { paneId } })}
			>
				<ChevronRightIcon />
			</Button>
			<span className="tab-bar-sep" aria-hidden="true" />
		</>
	)
}

function RightSidebarToggle() {
	const collapsed = useUIStore((state) => state.rightSidebarCollapsed)
	const label = collapsed ? "Show right sidebar" : "Hide right sidebar"
	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className="tab-bar-right-toggle"
			aria-label={label}
			aria-pressed={!collapsed}
			title={label}
			onClick={() => executeCommand("view.toggle-right-sidebar", { source: "menu" })}
		>
			<PanelRightIcon size={16} strokeWidth={2} />
		</Button>
	)
}

function HiddenTabsMenu({
	tabs,
	activeTabId,
	paneId,
	onActivate,
}: {
	tabs: TabItem[]
	activeTabId: string | null
	paneId: string
	onActivate: (tabId: string) => void
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="tab-more" aria-label={`${tabs.length} more tabs`}>
					+{tabs.length}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					{tabs.length} more {tabs.length === 1 ? "tab" : "tabs"}
				</DropdownMenuLabel>
				{tabs.map((tab) => (
					<DropdownMenuItem key={tab.id} onSelect={() => onActivate(tab.id)}>
						{tab.viewId === DATABASE_VIEW_ID ? <Table2Icon /> : <FileTextIcon />}
						<span className="truncate">{tab.title}</span>
					</DropdownMenuItem>
				))}
				{activeTabId && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() =>
								useWorkspaceStore.getState().closeOtherTabs(activeTabId, paneId, "others")
							}
						>
							Close other tabs
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function useTabCapacity(rowRef: React.RefObject<HTMLDivElement | null>): number {
	const [capacity, setCapacity] = useState(Number.POSITIVE_INFINITY)
	useLayoutEffect(() => {
		const row = rowRef.current
		if (!row || typeof ResizeObserver === "undefined") return
		const measure = () => {
			if (row.clientWidth === 0) return
			const style = getComputedStyle(row)
			const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
			const gap = Number.parseFloat(style.columnGap) || 0
			const fixedChildren = Array.from(row.children).filter(
				(child) =>
					!child.classList.contains("tab-bar") && !child.classList.contains("tab-bar-fill"),
			) as HTMLElement[]
			const fixedWidth = fixedChildren.reduce((total, child) => total + child.offsetWidth + gap, 0)
			const activeTab = row.querySelector<HTMLElement>('.tab-trigger[aria-selected="true"]')
			const available = row.clientWidth - padding - fixedWidth - TAB_TRACK_RESERVED_WIDTH
			const activeWidth = activeTab?.offsetWidth ?? TAB_MIN_WIDTH
			setCapacity(Math.max(1, 1 + Math.floor((available - activeWidth) / (TAB_MIN_WIDTH + 2))))
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(row)
		const track = row.querySelector(".tab-bar")
		if (track) observer.observe(track)
		return () => observer.disconnect()
	}, [rowRef])
	return capacity
}

const TAB_MIN_WIDTH = 72
const TAB_TRACK_RESERVED_WIDTH = 96

export function TabBar({ tabs, activeTabId, paneId, onActivate, onClose, onContextMenu }: Props) {
	const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
	const rowRef = useRef<HTMLDivElement>(null)
	const showEndDropMarker = useDragStore(
		(s) =>
			s.dropTarget?.type === "tab" &&
			s.dropTarget.paneId === paneId &&
			!s.dropTarget.tabId &&
			s.dropTarget.insertIndex === tabs.length,
	)
	const capacity = useTabCapacity(rowRef)

	const visibleTabIds = useMemo(
		() => getVisibleTabIds(tabs, activeTabId, capacity),
		[tabs, activeTabId, capacity],
	)
	const hiddenTabs = tabs.filter((tab) => !visibleTabIds.has(tab.id))
	const activeTab = tabs.find((t) => t.id === activeTabId)

	const handleDragEnd = useCallback(() => setDraggingTabId(null), [])

	return (
		<TooltipProvider delayDuration={600} skipDelayDuration={200}>
			<Tabs
				ref={rowRef}
				className="tab-bar-row"
				value={activeTab?.id ?? ""}
				onValueChange={(value) => {
					const tab = tabs.find((t) => t.id === value)
					if (tab) onActivate(tab.id)
				}}
				data-drop-tabbar-count={tabs.length}
				data-drop-tabbar-pane-id={paneId}
			>
				<TabNavigationButtons paneId={paneId} />
				<TabsList className="tab-bar" aria-label="Open notes">
					{tabs.map((tab, tabIndex) => {
						if (!visibleTabIds.has(tab.id)) return null
						const isActive = tab.id === activeTabId
						return (
							<TabBarItem
								key={tab.id}
								tab={tab}
								paneId={paneId}
								isActive={isActive}
								isDragged={draggingTabId === tab.id}
								tabIndex={tabIndex}
								onActivate={onActivate}
								onClose={onClose}
								onContextMenu={onContextMenu}
								onDragEnd={handleDragEnd}
								onDragStart={setDraggingTabId}
							/>
						)
					})}
					{showEndDropMarker && <span className="tab-drop-marker-end" aria-hidden="true" />}
					{hiddenTabs.length > 0 && (
						<HiddenTabsMenu
							tabs={hiddenTabs}
							activeTabId={activeTabId}
							paneId={paneId}
							onActivate={onActivate}
						/>
					)}
				</TabsList>
				<Button
					variant="ghost"
					size="icon"
					className="tab-new"
					aria-label="New tab"
					onClick={() => executeCommand("tabs.new", { source: "menu", payload: { paneId } })}
				>
					<PlusIcon />
				</Button>
				<span className="tab-bar-fill" />
				<RightSidebarToggle />
			</Tabs>
		</TooltipProvider>
	)
}
