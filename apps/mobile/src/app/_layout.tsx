import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { StyleSheet } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import { initializeMobileHost } from "@/bootstrap/mobileHost"
import { AppGate } from "@/features/layout/AppGate"
import { useMobileColors } from "@/hooks/useMobileColors"
import { useSettingsColorScheme } from "@/hooks/useSettingsColorScheme"

initializeMobileHost()

export default function TabLayout() {
	useSettingsColorScheme()
	const { scheme } = useMobileColors()

	return (
		<ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
			<GestureHandlerRootView style={styles.root}>
				<AppGate />
				<StatusBar style="auto" />
			</GestureHandlerRootView>
		</ThemeProvider>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
