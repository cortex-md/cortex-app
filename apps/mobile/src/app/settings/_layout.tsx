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
			<Stack.Screen name="notifications" options={{ title: "Notifications" }} />
			<Stack.Screen name="import-export" options={{ title: "Import & Export" }} />
			<Stack.Screen name="general" options={{ title: "General" }} />
			<Stack.Screen name="vaults" options={{ headerLargeTitleEnabled: true, title: "Vaults" }} />
			<Stack.Screen name="appearance" options={{ title: "Appearance" }} />
			<Stack.Screen name="editor" options={{ title: "Editor" }} />
			<Stack.Screen name="hotkeys" options={{ title: "Keyboard shortcuts" }} />
			<Stack.Screen name="plugins" options={{ title: "Plugins" }} />
			<Stack.Screen name="plan" options={{ title: "Cortex Sync" }} />
			<Stack.Screen name="sync/index" options={{ headerLargeTitleEnabled: true, title: "Sync" }} />
			<Stack.Screen name="sync/prefs" options={{ title: "Preferences" }} />
			<Stack.Screen name="sync/members" options={{ title: "Members" }} />
			<Stack.Screen name="sync/self-hosted" options={{ title: "Self-hosted" }} />
			<Stack.Screen name="sync/link" options={{ headerLargeTitleEnabled: true, title: "Sync" }} />
			<Stack.Screen name="sync-logs" options={{ title: "Sync logs" }} />
			<Stack.Screen name="deleted-notes" options={{ headerLargeTitleEnabled: true, title: "Deleted notes" }} />
			<Stack.Screen name="deleted-note" options={{ title: "" }} />
			<Stack.Screen name="templates" options={{ headerLargeTitleEnabled: true, title: "Templates" }} />
		</Stack>
	)
}
