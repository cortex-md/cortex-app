import { Stack } from "expo-router"

import { SidebarToggleButton } from "@/components/mobile-sidebar"

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
		</Stack>
	)
}
