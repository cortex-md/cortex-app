import { selectVisibleStatusBarItems, usePluginStore } from "@cortex/plugin-host-core"
import { Stack } from "expo-router"

export function PluginStatusMenu() {
	const statusBarItems = usePluginStore((state) => state.statusBarItems)
	const settingsValues = usePluginStore((state) => state.settingsValues)
	const items = selectVisibleStatusBarItems({ settingsValues, statusBarItems })
	if (items.length === 0) return null

	return (
		<Stack.Toolbar placement="right">
			<Stack.Toolbar.Menu
				accessibilityLabel="Plugin actions"
				icon="puzzlepiece.extension"
				title="Plugins"
			>
				{items.map((item) => (
					<Stack.Toolbar.MenuAction
						disabled={!item.onClick}
						key={item.key}
						onPress={item.onClick}
						subtitle={item.tooltip}
					>
						{item.text ?? item.tooltip ?? item.id}
					</Stack.Toolbar.MenuAction>
				))}
			</Stack.Toolbar.Menu>
		</Stack.Toolbar>
	)
}
