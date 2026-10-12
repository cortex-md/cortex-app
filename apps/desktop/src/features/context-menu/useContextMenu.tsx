import type { CommandIcon } from "@cortex/commands"
import { formatHotkeyDisplay } from "@cortex/hotkeys"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	LucideIcon,
} from "@cortex/ui"
import { type ComponentType, type ReactNode, useCallback, useState } from "react"
import {
	hasNativeMenu,
	type MenuItem,
	type MenuPosition,
	nativeContextMenu,
} from "@/utils/context-menu"

interface OpenContextMenu {
	items: MenuItem[]
	position: MenuPosition
}

export interface ContextMenuController {
	showMenu: (items: MenuItem[], position: MenuPosition) => void
	menu: ReactNode
}

export function MenuItemIcon({ icon }: { icon?: CommandIcon }) {
	if (!icon) return null
	if (typeof icon === "string") return <LucideIcon name={icon} />
	const Icon = icon as ComponentType
	return <Icon />
}

function getSeparatorKey(items: MenuItem[], index: number): string {
	const previous = items[index - 1]
	const next = items[index + 1]
	const previousId = previous && previous.type !== "separator" ? previous.id : "start"
	const nextId = next && next.type !== "separator" ? next.id : "end"
	return `separator-${previousId}-${nextId}`
}

export function MenuItemList({ items }: { items: MenuItem[] }) {
	return items.map((item, index) => {
		if (item.type === "separator") {
			return <DropdownMenuSeparator key={getSeparatorKey(items, index)} />
		}
		if (item.type === "label") {
			return <DropdownMenuLabel key={item.id}>{item.text}</DropdownMenuLabel>
		}
		if (item.type === "submenu") {
			return (
				<DropdownMenuSub key={item.id}>
					<DropdownMenuSubTrigger disabled={item.enabled === false}>
						<MenuItemIcon icon={item.icon} />
						{item.text}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<MenuItemList items={item.items} />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			)
		}
		return (
			<DropdownMenuItem
				key={item.id}
				disabled={item.enabled === false}
				variant={item.destructive ? "destructive" : "default"}
				onSelect={() => void item.action?.()}
			>
				<MenuItemIcon icon={item.icon} />
				{item.text}
				{item.hotkey && (
					<DropdownMenuShortcut>{formatHotkeyDisplay(item.hotkey)}</DropdownMenuShortcut>
				)}
			</DropdownMenuItem>
		)
	})
}

function FallbackContextMenu({ menu, onClose }: { menu: OpenContextMenu; onClose: () => void }) {
	return (
		<DropdownMenu
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DropdownMenuTrigger asChild>
				<span
					aria-hidden="true"
					style={{
						position: "fixed",
						left: menu.position.x,
						top: menu.position.y,
						width: 0,
						height: 0,
					}}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={2}
				alignOffset={2}
				className="w-56"
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<MenuItemList items={menu.items} />
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function useContextMenu(): ContextMenuController {
	const [openMenu, setOpenMenu] = useState<OpenContextMenu | null>(null)
	const closeMenu = useCallback(() => setOpenMenu(null), [])

	const showMenu = useCallback((items: MenuItem[], position: MenuPosition) => {
		if (items.length === 0) return
		if (hasNativeMenu()) {
			void nativeContextMenu.showContextMenu({ items, position })
			return
		}
		setOpenMenu({ items, position })
	}, [])

	return {
		showMenu,
		menu: openMenu ? <FallbackContextMenu menu={openMenu} onClose={closeMenu} /> : null,
	}
}
