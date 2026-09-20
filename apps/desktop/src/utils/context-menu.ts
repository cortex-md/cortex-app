import { getPlatform } from "@cortex/platform"

export type MenuItemType = "normal" | "separator" | "checkbox" | "submenu"

export type MenuItem = NormalMenuItem | SeparatorMenuItem | CheckboxMenuItem | SubmenuMenuItem

export interface MenuItemBase {
	id: string
	text: string
	enabled?: boolean
	accelerator?: string
	destructive?: boolean
}

export interface NormalMenuItem extends MenuItemBase {
	type?: "normal"
	action?: () => void | Promise<void>
}

export interface SeparatorMenuItem {
	type: "separator"
}

export interface CheckboxMenuItem extends MenuItemBase {
	type: "checkbox"
	checked: boolean
	action?: () => void | Promise<void>
}

export interface SubmenuMenuItem extends MenuItemBase {
	type: "submenu"
	items: MenuItem[]
}

export interface MenuPosition {
	x: number
	y: number
}

export interface ContextMenuOptions {
	items: MenuItem[]
	position?: MenuPosition
}

function collectActions(
	items: MenuItem[],
	actions = new Map<string, () => void | Promise<void>>(),
): Map<string, () => void | Promise<void>> {
	for (const item of items) {
		if (item.type === "separator") continue
		if (item.type === "submenu") {
			collectActions(item.items, actions)
			continue
		}
		if (item.action) actions.set(item.id, item.action)
	}
	return actions
}

function toPlatformItems(items: MenuItem[]): Parameters<
	ReturnType<typeof getPlatform>["dialog"]["showContextMenu"]
>[0]["items"] {
	return items.map((item) => {
		if (item.type === "separator") return { type: "separator" as const }
		if (item.type === "checkbox") {
			return {
				type: "checkbox" as const,
				id: item.id,
				text: item.text,
				enabled: item.enabled,
				accelerator: item.accelerator,
				destructive: item.destructive,
				checked: item.checked,
			}
		}
		if (item.type === "submenu") {
			return {
				type: "submenu" as const,
				id: item.id,
				text: item.text,
				enabled: item.enabled,
				accelerator: item.accelerator,
				destructive: item.destructive,
				items: toPlatformItems(item.items),
			}
		}
		return {
			type: "normal" as const,
			id: item.id,
			text: item.text,
			enabled: item.enabled,
			accelerator: item.accelerator,
			destructive: item.destructive,
		}
	})
}

export class NativeMenuActions {
	private isShowingMenu = false

	async showContextMenu(options: ContextMenuOptions): Promise<void> {
		if (this.isShowingMenu) return
		this.isShowingMenu = true
		try {
			const actions = collectActions(options.items)
			const selectedId = await getPlatform().dialog.showContextMenu({
				items: toPlatformItems(options.items),
				position: options.position,
			})
			if (!selectedId) return
			await actions.get(selectedId)?.()
		} finally {
			this.isShowingMenu = false
		}
	}
}
