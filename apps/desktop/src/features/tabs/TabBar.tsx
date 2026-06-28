import { useDragStore } from "@cortex/core"
import { Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useInternalDragSource } from "../split-view/useInternalDragSource"

const TAB_EXIT_DURATION_MS = 140

export interface TabItem {
	id: string
	title: string
	isPinned: boolean
	isDirty: boolean
}

interface Props {
	tabs: TabItem[]
	activeTabId: string | null
	paneId: string
	onActivate: (tabId: string) => void
	onClose: (tabId: string) => void
	onPin?: (tabId: string) => void
	onContextMenu?: (tabId: string, event: React.MouseEvent) => void
}

interface TabBarItemProps {
	tab: TabItem
	paneId: string
	isActive: boolean
	isDragged: boolean
	isClosing: boolean
	insertMarker: "before" | "after" | null
	tabIndex: number
	onActivate: (tabId: string) => void
	onClose: (tabId: string) => void
	onContextMenu?: (tabId: string, event: React.MouseEvent) => void
	onDragEnd: () => void
	onDragStart: (tabId: string) => void
}

function TabBarItem({
	tab,
	paneId,
	isActive,
	isDragged,
	isClosing,
	insertMarker,
	tabIndex,
	onActivate,
	onClose,
	onContextMenu,
	onDragEnd,
	onDragStart,
}: TabBarItemProps) {
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
		<TabsTrigger
			value={tab.id}
			role="tab"
			tabIndex={isActive ? 0 : -1}
			aria-selected={isActive}
			className={`tab-trigger group/tab ${tab.isPinned ? "tab-pinned" : ""} ${
				isDragged ? "tab-trigger--dragging" : ""
			} ${isClosing ? "tab-trigger--closing" : ""}`}
			data-drop-tab-id={tab.id}
			data-drop-tab-index={tabIndex}
			data-drop-tab-pane-id={paneId}
			data-tauri-no-drag-region=""
			{...dragProps}
			onClick={() => onActivate(tab.id)}
			onKeyDown={(e) => e.key === "Enter" && onActivate(tab.id)}
			onContextMenu={(e) => onContextMenu?.(tab.id, e)}
		>
			{insertMarker && <span className={`tab-drop-marker tab-drop-marker--${insertMarker}`} />}
			<span className="tab-title truncate">{tab.title}</span>
			{tab.isDirty && <span className="tab-dirty-dot" aria-hidden="true" />}
			{!tab.isPinned && (
				// biome-ignore lint/a11y/useSemanticElements: TabsTrigger already renders the tab button; a nested button would be invalid HTML
				<span
					role="button"
					tabIndex={-1}
					aria-label={`Close ${tab.title}`}
					className="tab-close-btn opacity-0 group-hover/tab:opacity-100 data-[active=true]:opacity-100 shrink-0 rounded p-0.5 hover:bg-bg-tertiary"
					data-active={isActive || undefined}
					data-tauri-no-drag-region=""
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
	)
	// oxlint-enable react-doctor/prefer-tag-over-role
}

export function TabBar({ tabs, activeTabId, paneId, onActivate, onClose, onContextMenu }: Props) {
	const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
	const [closingTabIds, setClosingTabIds] = useState<Set<string>>(() => new Set())
	const closeTimeoutsRef = useRef<Map<string, number> | null>(null)
	closeTimeoutsRef.current ??= new Map()
	const dropTarget = useDragStore((s) => s.dropTarget)

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- unmount cleanup must clear all currently pending close timers
	useEffect(() => {
		return () => {
			for (const timeoutId of closeTimeoutsRef.current?.values() ?? []) {
				window.clearTimeout(timeoutId)
			}
			closeTimeoutsRef.current?.clear()
		}
	}, [])

	if (tabs.length === 0) return null

	const activeTab = tabs.find((t) => t.id === activeTabId)

	const handleClose = (tabId: string) => {
		if (closingTabIds.has(tabId)) return

		setClosingTabIds((current) => {
			const next = new Set(current)
			next.add(tabId)
			return next
		})

		const timeoutId = window.setTimeout(() => {
			closeTimeoutsRef.current?.delete(tabId)
			onClose(tabId)
			setClosingTabIds((current) => {
				if (!current.has(tabId)) return current
				const next = new Set(current)
				next.delete(tabId)
				return next
			})
		}, TAB_EXIT_DURATION_MS)

		closeTimeoutsRef.current?.set(tabId, timeoutId)
	}

	return (
		<Tabs
			value={activeTab?.id}
			onValueChange={(value) => {
				const tab = tabs.find((t) => t.id === value)
				if (tab) onActivate(tab.id)
			}}
		>
			<TabsList
				className="tab-bar"
				data-tauri-drag-region=""
				data-drop-tabbar-count={tabs.length}
				data-drop-tabbar-pane-id={paneId}
			>
				{tabs.map((tab, tabIndex) => {
					const isActive = tab.id === activeTabId
					const isDragged = draggingTabId === tab.id
					const isClosing = closingTabIds.has(tab.id)
					const insertMarker =
						dropTarget?.type === "tab" &&
						dropTarget.paneId === paneId &&
						dropTarget.tabId === tab.id
							? (dropTarget.tabPosition ?? null)
							: null
					return (
						<TabBarItem
							key={tab.id}
							tab={tab}
							paneId={paneId}
							isActive={isActive}
							isDragged={isDragged}
							isClosing={isClosing}
							insertMarker={insertMarker}
							tabIndex={tabIndex}
							onActivate={onActivate}
							onClose={handleClose}
							onContextMenu={onContextMenu}
							onDragEnd={() => setDraggingTabId(null)}
							onDragStart={setDraggingTabId}
						/>
					)
				})}
				{dropTarget?.type === "tab" &&
					dropTarget.paneId === paneId &&
					!dropTarget.tabId &&
					dropTarget.insertIndex === tabs.length && (
						<span className="tab-drop-marker-end" aria-hidden="true" />
					)}
			</TabsList>
		</Tabs>
	)
}
