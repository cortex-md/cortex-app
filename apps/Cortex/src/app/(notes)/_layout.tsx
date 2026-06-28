import { Stack } from "expo-router"

export default function NotesLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					headerLargeTitle: true,
					title: "Notes",
				}}
			/>
			<Stack.Screen
				name="note"
				options={{
					headerLargeTitle: false,
					title: "Note",
				}}
			/>
		</Stack>
	)
}
