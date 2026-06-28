import { initPlatform } from "@cortex/platform"
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { StyleSheet, useColorScheme } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import AppTabs from "@/components/app-tabs"
import { expoPlatform } from "@/platform/expo-platform"
import { installMobileCrypto } from "@/runtime/mobile-crypto"
import { initializeMobileProperties } from "@/runtime/mobile-properties"
import { useMobileRuntime } from "@/runtime/mobile-runtime"

installMobileCrypto()
initPlatform(expoPlatform)
initializeMobileProperties()

export default function TabLayout() {
	const colorScheme = useColorScheme()
	useMobileRuntime()

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<GestureHandlerRootView style={styles.root}>
				<AppTabs />
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
