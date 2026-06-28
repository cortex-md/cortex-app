import type {
	ContextMenuActionContext,
	ContextMenuItemRegistration,
	ContextMenuLocation,
} from "@cortex.md/api"
import type { MenuItem } from "@/utils/context-menu"

interface RegisteredContextMenuItem extends ContextMenuItemRegistration {
	registrationKey?: string
}

export function createPluginContextMenuItems(
	registrations: RegisteredContextMenuItem[],
	location: ContextMenuLocation,
	context: ContextMenuActionContext,
): MenuItem[] {
	const pluginItems = registrations.filter((item) => item.location === location)
	if (pluginItems.length === 0) return []
	return [
		{ type: "separator" },
		...pluginItems.map((item) => ({
			id: `plugin-${location}-${item.registrationKey ?? item.id}`,
			text: item.label,
			action: () => item.action(context),
		})),
	]
}
