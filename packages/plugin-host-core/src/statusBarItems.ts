import type { PluginStoreState, RegisteredStatusBarItem } from "./pluginStore"

export function selectVisibleStatusBarItems(
	state: Pick<PluginStoreState, "statusBarItems" | "settingsValues">,
): RegisteredStatusBarItem[] {
	return state.statusBarItems
		.filter((item) => !item.when || state.settingsValues[item.owner]?.[item.when] === true)
		.sort((first, second) => second.priority - first.priority)
}
