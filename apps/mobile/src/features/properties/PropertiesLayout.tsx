import { useEditorStore } from "@cortex/core"
import { useGlobalSearchParams } from "expo-router"
import { Stack } from "expo-router/stack"
import { useState } from "react"
import { Platform } from "react-native"

import { PropertiesProvider } from "@/features/properties/PropertiesContext"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function PropertiesLayout() {
	const { colors } = useMobileColors()
	const params = useGlobalSearchParams<{ filePath?: string | string[] }>()
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [filePath] = useState(() => {
		const value = Array.isArray(params.filePath) ? params.filePath[0] : params.filePath
		return value ?? activeFilePath
	})

	return (
		<PropertiesProvider filePath={filePath}>
			<Stack
				screenOptions={{
					contentStyle: { backgroundColor: colors.groupedBackground },
					headerBackButtonDisplayMode: "minimal",
					headerShadowVisible: false,
					headerShown: true,
					headerStyle: IS_IOS ? undefined : { backgroundColor: colors.groupedBackground },
					headerTintColor: colors.tint,
					headerTitleStyle: { color: colors.label },
					headerTransparent: IS_IOS,
				}}
			>
				<Stack.Screen name="index" options={{ title: "Properties" }} />
				<Stack.Screen name="add" options={{ title: "Add property" }} />
				<Stack.Screen name="edit" options={{ title: "Edit property" }} />
				<Stack.Screen name="option" options={{ title: "Edit option" }} />
				<Stack.Screen name="auto" options={{ title: "Automatic properties" }} />
				<Stack.Screen name="value" />
				<Stack.Screen name="select" />
				<Stack.Screen name="person" />
				<Stack.Screen name="date" />
			</Stack>
		</PropertiesProvider>
	)
}
