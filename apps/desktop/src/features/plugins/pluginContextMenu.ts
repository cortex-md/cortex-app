import { type PluginStoreState, selectContextMenuItems } from "@cortex/plugin-host-core"
import type { ContextMenuActionContext, ContextMenuLocation } from "@cortex.md/api"
import type { MenuItem } from "@/utils/context-menu"

export function createPluginContextMenuItems(
	state: Pick<PluginStoreState, "contextMenuItems">,
	location: ContextMenuLocation,
	context: ContextMenuActionContext,
): MenuItem[] {
	const actions = selectContextMenuItems(state, location, context)
	if (actions.length === 0) return []
	return [
		{ type: "separator" },
		...actions.map((action) => ({
			id: `plugin-${location}-${action.key}`,
			text: action.label,
			icon: action.icon,
			action: action.run,
		})),
	]
}
