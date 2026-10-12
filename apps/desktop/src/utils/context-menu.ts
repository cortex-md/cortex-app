import { type CommandIcon, commandRegistry, executeCommand } from "@cortex/commands"
import { useHotkeysStore } from "@cortex/hotkeys"
import { getPlatform, type ContextMenuItem as PlatformMenuItem } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import type { ContextMenuActionContext } from "@cortex.md/api"
import { createPluginContextMenuItems } from "../features/plugins/pluginContextMenu"

export type MenuItem = NormalMenuItem | SeparatorMenuItem | LabelMenuItem | SubmenuMenuItem

export interface MenuItemBase {
	id: string
	text: string
	enabled?: boolean
	hotkey?: string
	icon?: CommandIcon
	destructive?: boolean
}

export interface NormalMenuItem extends MenuItemBase {
	type?: "normal"
	action?: () => void | Promise<void>
}

export interface SeparatorMenuItem {
	type: "separator"
}

export interface LabelMenuItem {
	type: "label"
	id: string
	text: string
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

export interface CommandMenuItemOptions {
	id?: string
	text?: string
	payload?: unknown
	icon?: CommandIcon
	destructive?: boolean
	enabled?: boolean
	action?: () => void | Promise<void>
}

export const MENU_SEPARATOR: SeparatorMenuItem = { type: "separator" }

export function hasNativeMenu(): boolean {
	return getPlatform().capabilities.includes("menu")
}

export function getCommandHotkey(commandId: string): string | undefined {
	const binding = useHotkeysStore.getState().bindings.find((entry) => entry.id === commandId)
	return binding?.enabled && binding.keys ? binding.keys : undefined
}

export function commandMenuItem(
	commandId: string,
	options: CommandMenuItemOptions = {},
): NormalMenuItem | null {
	const command = commandRegistry.get(commandId)
	const text = options.text ?? command?.label
	if (!text) return null
	return {
		id: options.id ?? commandId,
		text,
		icon: options.icon ?? command?.icon,
		hotkey: getCommandHotkey(commandId),
		destructive: options.destructive,
		enabled: options.enabled,
		action:
			options.action ??
			(() => {
				executeCommand(commandId, { source: "menu", payload: options.payload })
			}),
	}
}

export function compactMenuItems(entries: Array<MenuItem | null | false | undefined>): MenuItem[] {
	const items: MenuItem[] = []
	for (const entry of entries) {
		if (!entry) continue
		if (entry.type === "separator") {
			const previous = items.at(-1)
			if (!previous || previous.type === "separator") continue
		}
		items.push(entry)
	}
	while (items.at(-1)?.type === "separator") items.pop()
	return items
}

export function getPluginMenuItems(context: ContextMenuActionContext): MenuItem[] {
	return createPluginContextMenuItems(usePluginStore.getState(), context.location, context)
}

const ACCELERATOR_MODIFIERS: Record<string, string> = {
	mod: "CmdOrCtrl",
	shift: "Shift",
	alt: "Alt",
	ctrl: "Ctrl",
	meta: "Super",
}

export function toAccelerator(hotkey: string): string {
	return hotkey
		.split("+")
		.map((part) => {
			const modifier = ACCELERATOR_MODIFIERS[part.toLowerCase()]
			if (modifier) return modifier
			return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)
		})
		.join("+")
}

function collectActions(
	items: MenuItem[],
	actions = new Map<string, () => void | Promise<void>>(),
): Map<string, () => void | Promise<void>> {
	for (const item of items) {
		if (item.type === "separator" || item.type === "label") continue
		if (item.type === "submenu") {
			collectActions(item.items, actions)
			continue
		}
		if (item.action) actions.set(item.id, item.action)
	}
	return actions
}

function toPlatformItems(items: MenuItem[]): PlatformMenuItem[] {
	return items.map((item): PlatformMenuItem => {
		if (item.type === "separator") return { type: "separator" }
		if (item.type === "label")
			return { type: "normal", id: item.id, text: item.text, enabled: false }
		const base = {
			id: item.id,
			text: item.text,
			enabled: item.enabled,
			accelerator: item.hotkey ? toAccelerator(item.hotkey) : undefined,
			destructive: item.destructive,
		}
		if (item.type === "submenu") {
			return { ...base, type: "submenu", items: toPlatformItems(item.items) }
		}
		return { ...base, type: "normal" }
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

export const nativeContextMenu = new NativeMenuActions()
