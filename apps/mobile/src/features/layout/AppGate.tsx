import { useVaultStore } from "@cortex/core"
import { Stack } from "expo-router"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen"
import { PluginModalHost } from "@/features/plugins/PluginModalHost"
import { SidebarProvider } from "@/features/sidebar/SidebarProvider"
import { WorkspaceHost } from "@/features/workspace/WorkspaceHost"
import { useMobileColors } from "@/hooks/useMobileColors"
import { useMobileRuntime } from "@/hooks/useMobileRuntime"

export function AppGate() {
	const { ready, startupError } = useMobileRuntime()
	const { colors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)

	if (!ready) {
		return (
			<View style={[styles.loading, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.tint} />
				<Text style={[styles.loadingText, { color: colors.secondaryLabel }]}>Opening Cortex</Text>
			</View>
		)
	}

	if (!vault) {
		return <OnboardingScreen startupError={startupError} />
	}

	return (
		<SidebarProvider>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(notes)" />
				<Stack.Screen name="(settings)" />
				<Stack.Screen name="(search)" />
			</Stack>
			<WorkspaceHost />
			<PluginModalHost />
		</SidebarProvider>
	)
}

const styles = StyleSheet.create({
	loading: {
		alignItems: "center",
		flex: 1,
		gap: 12,
		justifyContent: "center",
	},
	loadingText: {
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 20,
	},
})
