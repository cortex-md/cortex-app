import { ThemeProvider } from "expo-router/react-navigation"
import { StatusBar } from "expo-status-bar"
import { useMemo } from "react"
import { StyleSheet } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import { initializeMobileHost } from "@/bootstrap/mobileHost"
import { AppGate } from "@/features/layout/AppGate"
import { useMobileColors } from "@/hooks/useMobileColors"
import { useSettingsColorScheme } from "@/hooks/useSettingsColorScheme"
import { createNavigationTheme } from "@/theme/navigationTheme"

initializeMobileHost()

export default function RootLayout() {
	useSettingsColorScheme()
	const { colors, scheme } = useMobileColors()
	const navigationTheme = useMemo(() => createNavigationTheme(colors), [colors])

	return (
		<ThemeProvider value={navigationTheme}>
			<GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
				<AppGate />
				<StatusBar style={scheme === "dark" ? "light" : "dark"} />
			</GestureHandlerRootView>
		</ThemeProvider>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
