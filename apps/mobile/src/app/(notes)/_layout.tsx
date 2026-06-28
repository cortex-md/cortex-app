import { Stack } from "expo-router"

import { SidebarToggleButton } from "@/components/mobile-sidebar"

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
