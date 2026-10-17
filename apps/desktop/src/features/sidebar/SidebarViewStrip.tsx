import { Button, LucideIcon, SimpleTooltip } from "@cortex/ui"
import { type KeyboardEvent, type MouseEvent, useRef } from "react"
import { useContextMenu } from "../context-menu/useContextMenu"
import type { SidebarViewItem } from "../file-explorer/sidebarViewUtils"
import { ribbonMenuItems } from "./ribbon"

interface SidebarViewStripProps {
	items: SidebarViewItem[]
	activeId: string
	onSelect: (id: string) => void
}

export function SidebarViewStrip({ items, activeId, onSelect }: SidebarViewStripProps) {
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
	const { showMenu, menu } = useContextMenu()

	const handleKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
		let targetIndex: number | null = null
		if (event.key === "ArrowLeft") targetIndex = index === 0 ? items.length - 1 : index - 1
		if (event.key === "ArrowRight") targetIndex = index === items.length - 1 ? 0 : index + 1
		if (event.key === "Home") targetIndex = 0
		if (event.key === "End") targetIndex = items.length - 1
		if (targetIndex === null) return
		event.preventDefault()
		buttonRefs.current[targetIndex]?.focus()
	}

	const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
		event.preventDefault()
		showMenu(ribbonMenuItems(), { x: event.clientX, y: event.clientY })
	}

	return (
		<div
			className="sidebar-view-strip"
			role="tablist"
			aria-label="Sidebar views"
			aria-orientation="horizontal"
			onContextMenu={handleContextMenu}
		>
			{items.map((item, index) => {
				const isActive = item.id === activeId
				return (
					<SimpleTooltip key={item.id} side="bottom" label={item.label}>
						<Button
							size="icon-sm"
							ref={(element) => {
								buttonRefs.current[index] = element
							}}
							variant="ghost"
							type="button"
							role="tab"
							id={`sidebar-view-tab-${item.id}`}
							aria-controls="sidebar-view-panel"
							aria-label={item.label}
							aria-selected={isActive}
							data-active={isActive}
							tabIndex={isActive ? 0 : -1}
							className="sidebar-view-strip-button"
							onKeyDown={(event) => handleKeyDown(index, event)}
							onClick={() => onSelect(item.id)}
						>
							{typeof item.icon === "string" ? (
								<LucideIcon name={item.icon} size={17} strokeWidth={2} />
							) : (
								<item.icon size={17} strokeWidth={2} />
							)}
						</Button>
					</SimpleTooltip>
				)
			})}
			{menu}
		</div>
	)
}
