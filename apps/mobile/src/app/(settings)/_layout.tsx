import { Stack } from "expo-router"

import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"

export default function SettingsLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					headerLeft: () => <SidebarToggleButton />,
					headerLargeTitle: true,
					title: "Settings",
				}}
			/>
			<Stack.Screen name="plugin-settings" options={{ title: "Plugin" }} />
			<Stack.Screen name="marketplace" options={{ title: "Community plugins" }} />
			<Stack.Screen name="marketplace-detail" options={{ title: "Plugin" }} />
			<Stack.Screen name="marketplace-readme" options={{ title: "README" }} />
		</Stack>
	)
}
