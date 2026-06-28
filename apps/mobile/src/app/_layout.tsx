import { initPlatform } from "@cortex/platform"
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { StyleSheet, useColorScheme } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import { MobileAppGate } from "@/components/mobile-app-gate"
import { expoPlatform } from "@/platform/expo-platform"
import { installMobileCrypto } from "@/runtime/mobile-crypto"
import { initializeMobileProperties } from "@/runtime/mobile-properties"

installMobileCrypto()
initPlatform(expoPlatform)
initializeMobileProperties()

export default function TabLayout() {
	const colorScheme = useColorScheme()

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<GestureHandlerRootView style={styles.root}>
				<MobileAppGate />
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
