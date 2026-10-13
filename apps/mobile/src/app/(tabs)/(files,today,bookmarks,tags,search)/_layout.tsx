import { Stack } from "expo-router/stack"

import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"

const rootTitles: Record<string, string> = {
	"(bookmarks)": "Bookmarks",
	"(files)": "Files",
	"(search)": "Search",
	"(tags)": "Tags",
	"(today)": "Today",
}

export default function TabStackLayout({ segment }: { segment: string }) {
	const screenOptions = useStackScreenOptions()

	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen
				name="index"
				options={{ headerLargeTitleEnabled: true, title: rootTitles[segment] ?? "" }}
			/>
			<Stack.Screen name="folder" options={{ headerLargeTitleEnabled: true }} />
			<Stack.Screen name="note" options={{ headerLargeTitleEnabled: false }} />
			<Stack.Screen name="database" options={{ headerLargeTitleEnabled: true }} />
			<Stack.Screen name="tag" options={{ headerLargeTitleEnabled: true }} />
			<Stack.Screen name="plugin-view" options={{ headerLargeTitleEnabled: false }} />
			<Stack.Screen name="version-history" options={{ headerLargeTitleEnabled: false, title: "Version history" }} />
			<Stack.Screen name="version" options={{ headerLargeTitleEnabled: false }} />
			<Stack.Screen name="template-editor" options={{ headerLargeTitleEnabled: false }} />
			<Stack.Screen name="conflict" options={{ headerLargeTitleEnabled: false }} />
			<Stack.Screen name="database-row" options={{ headerLargeTitleEnabled: false }} />
		</Stack>
	)
}
