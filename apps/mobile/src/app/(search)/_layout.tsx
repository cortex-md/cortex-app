import { Stack } from "expo-router"

import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"

export default function SearchLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					headerLeft: () => <SidebarToggleButton />,
					headerLargeTitle: true,
					title: "Search",
				}}
			/>
		</Stack>
	)
}
