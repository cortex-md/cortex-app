import { useMarketplaceStore } from "@cortex/marketplace"
import {
	Button,
	LucideIcon,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import { LayoutTemplateIcon, SettingsIcon, StoreIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useRef } from "react"
import type { SidebarViewItem } from "../file-explorer/sidebarViewUtils"
import { useInternalDragSource } from "../split-view/useInternalDragSource"
import { TasksRailBadge } from "../tasks/TasksSidebar"
import { TASKS_SIDEBAR_VIEW_ID } from "../tasks/taskModel"
import { openTemplatesView } from "../templates/templateActions"

interface SidebarRailProps {
	items: SidebarViewItem[]
	activeId: string
	collapsed: boolean
	onSelect: (id: string) => void
	onOpenMarketplace: () => void
	onOpenSettings: () => void
}

interface SidebarRailViewButtonProps {
	item: SidebarViewItem
	isActive: boolean
	buttonRef: (element: HTMLButtonElement | null) => void
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
	onSelect: (id: string) => void
}

function RailTooltip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side="right" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	)
}

function SidebarRailViewButton({
	item,
	isActive,
	buttonRef,
	onKeyDown,
	onSelect,
}: SidebarRailViewButtonProps) {
	const dragProps = useInternalDragSource(
		() => ({
			type: "sidebar-view",
			viewId: item.viewId ?? item.id,
			viewTitle: item.label,
		}),
		{ disabled: item.draggable === false },
	)

	return (
		<RailTooltip label={item.label}>
			<Button
				ref={buttonRef}
				variant="ghost"
				type="button"
				role="tab"
				id={`sidebar-view-tab-${item.id}`}
				aria-controls="sidebar-view-panel"
				aria-label={item.label}
				aria-selected={isActive}
				data-active={isActive}
				tabIndex={isActive ? 0 : -1}
				className="sidebar-rail-button"
				onKeyDown={onKeyDown}
				onClick={() => onSelect(item.id)}
				{...dragProps}
			>
				{typeof item.icon === "string" ? (
					<LucideIcon name={item.icon} size={18} strokeWidth={2} />
				) : (
					<item.icon size={18} strokeWidth={2} />
				)}
				{item.id === TASKS_SIDEBAR_VIEW_ID && <TasksRailBadge />}
			</Button>
		</RailTooltip>
	)
}

function openTemplates() {
	openTemplatesView()
}

function MarketplaceRailButton({ onOpen }: { onOpen: () => void }) {
	const updateCount = useMarketplaceStore(
		(state) => Object.values(state.availableUpdates).filter(Boolean).length,
	)
	const label =
		updateCount > 0
			? `Marketplace, ${updateCount} ${updateCount === 1 ? "update" : "updates"}`
			: "Marketplace"

	return (
		<RailTooltip label={label}>
			<Button
				variant="ghost"
				type="button"
				aria-label={label}
				className="sidebar-rail-button"
				onClick={onOpen}
			>
				<StoreIcon size={18} strokeWidth={2} />
				{updateCount > 0 && (
					<span className="sidebar-rail-badge" aria-hidden="true">
						{updateCount}
					</span>
				)}
			</Button>
		</RailTooltip>
	)
}

export function SidebarRail({
	items,
	activeId,
	collapsed,
	onSelect,
	onOpenMarketplace,
	onOpenSettings,
}: SidebarRailProps) {
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

	const handleKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
		let targetIndex: number | null = null
		if (event.key === "ArrowUp") targetIndex = index === 0 ? items.length - 1 : index - 1
		if (event.key === "ArrowDown") targetIndex = index === items.length - 1 ? 0 : index + 1
		if (event.key === "Home") targetIndex = 0
		if (event.key === "End") targetIndex = items.length - 1
		if (targetIndex === null) return
		event.preventDefault()
		buttonRefs.current[targetIndex]?.focus()
	}

	return (
		<TooltipProvider delayDuration={320}>
			<nav className="sidebar-rail" aria-label="Sidebar views">
				<div className="sidebar-rail-views" role="tablist" aria-orientation="vertical">
					{items.map((item, index) => (
						<SidebarRailViewButton
							key={item.id}
							item={item}
							isActive={!collapsed && item.id === activeId}
							buttonRef={(element) => {
								buttonRefs.current[index] = element
							}}
							onKeyDown={(event) => handleKeyDown(index, event)}
							onSelect={onSelect}
						/>
					))}
				</div>
				<span className="sidebar-rail-fill" />
				<RailTooltip label="Templates">
					<Button
						variant="ghost"
						type="button"
						aria-label="Templates"
						className="sidebar-rail-button"
						onClick={openTemplates}
					>
						<LayoutTemplateIcon size={18} strokeWidth={2} />
					</Button>
				</RailTooltip>
				<MarketplaceRailButton onOpen={onOpenMarketplace} />
				<RailTooltip label="Settings">
					<Button
						variant="ghost"
						type="button"
						aria-label="Settings"
						className="sidebar-rail-button"
						onClick={onOpenSettings}
					>
						<SettingsIcon size={18} strokeWidth={2} />
					</Button>
				</RailTooltip>
			</nav>
		</TooltipProvider>
	)
}
