import { usePluginStore } from "@cortex/plugin-host-core"
import { Stack, useLocalSearchParams } from "expo-router"
import { ScrollView, StyleSheet, Text } from "react-native"

import { PluginView } from "@/features/plugins/PluginView"
import { useMobileColors } from "@/hooks/useMobileColors"

export function PluginViewScreen() {
	const { viewKey } = useLocalSearchParams<{ viewKey?: string }>()
	const registration = usePluginStore((state) => state.views.find((view) => view.key === viewKey))
	const { colors } = useMobileColors()

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: colors.background }}
		>
			<Stack.Screen options={{ title: registration?.label ?? "Plugin" }} />
			{registration ? (
				<PluginView registration={registration} />
			) : (
				<Text style={[styles.message, { color: colors.secondaryLabel }]}>
					This plugin view is not available. Enable its plugin in Settings.
				</Text>
			)}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 12,
		padding: 16,
	},
	message: {
		fontSize: 15,
		lineHeight: 20,
		textAlign: "center",
	},
})
