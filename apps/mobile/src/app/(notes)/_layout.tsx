import { Stack } from "expo-router"

import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"

export default function NotesLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					headerLeft: () => <SidebarToggleButton />,
					headerLargeTitle: true,
					title: "Files",
				}}
			/>
			<Stack.Screen
				name="note"
				options={{
					headerLargeTitle: false,
					title: "Note",
				}}
			/>
			<Stack.Screen name="plugin-view" options={{ title: "Plugin" }} />
			<Stack.Screen
				name="folder"
				options={{
					headerLeft: () => <SidebarToggleButton />,
					headerLargeTitle: true,
					title: "Folder",
				}}
			/>
		</Stack>
	)
}
