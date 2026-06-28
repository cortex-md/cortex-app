import { useVaultStore } from "@cortex/core"
import { Stack } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native"

import { MobileSidebarProvider } from "@/components/mobile-sidebar"
import { MobileOnboardingScreen } from "@/features/onboarding/MobileOnboardingScreen"
import {
	readLastActiveVaultPath,
	writeLastActiveVaultPath,
} from "@/runtime/mobile-startup-state"
import { useMobileRuntime } from "@/runtime/mobile-runtime"
import { openMobileVault } from "@/runtime/mobile-vault-session"
import { getMobileColorScheme, mobileColors } from "@/theme/colors"

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function MobileAppGate() {
	const runtimeReady = useMobileRuntime()
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const vault = useVaultStore((state) => state.vault)
	const [startupReady, setStartupReady] = useState(false)
	const [startupError, setStartupError] = useState<string | null>(null)
	const startupAttemptedRef = useRef(false)

	useEffect(() => {
		if (!runtimeReady) return
		if (vault || startupAttemptedRef.current) return

		startupAttemptedRef.current = true
		let canceled = false
		void (async () => {
			const lastActiveVaultPath = await readLastActiveVaultPath()
			if (!lastActiveVaultPath) {
				if (!canceled) setStartupReady(true)
				return
			}

			const recentVault = useVaultStore
				.getState()
				.recentVaults.find((entry) => entry.path === lastActiveVaultPath)

			try {
				await openMobileVault(lastActiveVaultPath, {
					color: recentVault?.color ?? undefined,
					icon: recentVault?.icon ?? undefined,
					name: recentVault?.name,
				})
			} catch (error) {
				await writeLastActiveVaultPath(null).catch(() => {})
				if (!canceled) setStartupError(formatError(error))
			} finally {
				if (!canceled) setStartupReady(true)
			}
		})()

		return () => {
			canceled = true
		}
	}, [runtimeReady, vault])

	if (!runtimeReady || (!vault && !startupReady)) {
		return (
			<View style={[styles.loading, { backgroundColor: colors.background }]}>
				<ActivityIndicator color={colors.tint} />
				<Text style={[styles.loadingText, { color: colors.secondaryLabel }]}>Opening Cortex</Text>
			</View>
		)
	}

	if (!vault) {
		return <MobileOnboardingScreen startupError={startupError} />
	}

	return (
		<MobileSidebarProvider>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(notes)" />
				<Stack.Screen name="(settings)" />
				<Stack.Screen name="(search)" />
			</Stack>
		</MobileSidebarProvider>
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
