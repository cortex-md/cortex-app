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
			<Stack.Screen name="version-history" options={{ title: "Version history" }} />
		</Stack>
	)
}
