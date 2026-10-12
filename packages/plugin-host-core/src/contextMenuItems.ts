import type { ContextMenuActionContext, ContextMenuLocation } from "@cortex.md/api"
import type { PluginStoreState } from "./pluginStore"

export interface PluginContextMenuAction {
	key: string
	label: string
	icon?: string
	run: () => void
}

export function selectContextMenuItems(
	state: Pick<PluginStoreState, "contextMenuItems">,
	location: ContextMenuLocation,
	context: ContextMenuActionContext,
): PluginContextMenuAction[] {
	return state.contextMenuItems
		.filter((item) => item.location === location)
		.map((item) => ({
			key: item.key,
			label: item.label,
			icon: item.icon,
			run: () => item.action(context),
		}))
}
