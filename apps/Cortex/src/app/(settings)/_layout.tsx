import { Stack } from "expo-router"

export default function SettingsLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					headerLargeTitle: true,
					title: "Settings",
				}}
			/>
		</Stack>
	)
}
