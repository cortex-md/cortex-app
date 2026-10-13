import { Stack } from "expo-router/stack"

import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"

export default function SettingsLayout() {
	const screenOptions = useStackScreenOptions()

	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="index" options={{ headerLargeTitleEnabled: true, title: "Settings" }} />
			<Stack.Screen name="plugin-settings" options={{ title: "Plugin" }} />
			<Stack.Screen name="marketplace" options={{ headerLargeTitleEnabled: true, title: "Marketplace" }} />
			<Stack.Screen name="marketplace-detail" options={{ title: "" }} />
			<Stack.Screen name="marketplace-readme" options={{ title: "README" }} />
		</Stack>
	)
}
