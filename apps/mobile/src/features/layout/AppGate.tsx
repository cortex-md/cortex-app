import { useVaultStore } from "@cortex/core"
import { Stack } from "expo-router"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { ToastHost } from "@/features/feedback/ToastHost"
import { FileExplorerHost } from "@/features/file-explorer/FileExplorerHost"
import {
	formSheetOptions,
	fullScreenFormOptions,
	fullScreenOrSheetOptions,
} from "@/features/navigation/sheetPresentation"
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen"
import { PluginModalHost } from "@/features/plugins/PluginModalHost"
import { SidebarProvider } from "@/features/sidebar/SidebarProvider"
import { WorkspaceHost } from "@/features/workspace/WorkspaceHost"
import { useMobileColors } from "@/hooks/useMobileColors"
import { useMobileRuntime } from "@/hooks/useMobileRuntime"

const NESTED_STACK = { headerShown: false }

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
			<Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
				<Stack.Screen
					name="(tabs)"
					options={{
						contentStyle: { backgroundColor: colors.groupedBackground },
						headerShown: false,
					}}
				/>
				<Stack.Screen name="settings" options={{ headerShown: false }} />
				<Stack.Screen name="onboarding" options={fullScreenFormOptions()} />
				<Stack.Screen name="vault-switcher" options={formSheetOptions("large")} />
				<Stack.Screen name="add-vault" options={fullScreenOrSheetOptions("large", NESTED_STACK)} />
				<Stack.Screen name="quick-finder" options={fullScreenOrSheetOptions("large")} />
				<Stack.Screen name="command-palette" options={formSheetOptions("large")} />
				<Stack.Screen name="properties" options={formSheetOptions([0.55, 0.92], NESTED_STACK)} />
				<Stack.Screen name="outline" options={formSheetOptions("medium")} />
				<Stack.Screen name="comments" options={formSheetOptions([0.65, 1])} />
				<Stack.Screen name="people" options={formSheetOptions("large")} />
				<Stack.Screen name="quick-add" options={formSheetOptions("medium")} />
				<Stack.Screen name="export" options={formSheetOptions("medium")} />
				<Stack.Screen name="task" options={fullScreenOrSheetOptions("large")} />
				<Stack.Screen
					name="from-template"
					options={fullScreenOrSheetOptions("large", NESTED_STACK)}
				/>
				<Stack.Screen name="insert-template" options={formSheetOptions("large")} />
				<Stack.Screen name="import" options={fullScreenOrSheetOptions("large", NESTED_STACK)} />
				<Stack.Screen
					name="share-template"
					options={fullScreenOrSheetOptions("large", NESTED_STACK)}
				/>
				<Stack.Screen name="db-view-options" options={formSheetOptions("medium")} />
				<Stack.Screen name="database-row-sheet" options={fullScreenOrSheetOptions("medium")} />
				<Stack.Screen name="db-new" options={fullScreenFormOptions()} />
				<Stack.Screen name="tabs" options={fullScreenFormOptions()} />
			</Stack>
			<WorkspaceHost />
			<PluginModalHost />
			<FileExplorerHost />
			<ToastHost />
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
