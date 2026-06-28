import { initPlatform } from "@cortex/platform"
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { StyleSheet, useColorScheme } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import { MobileSidebarProvider } from "@/components/mobile-sidebar"
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
				<MobileSidebarProvider>
					<Stack screenOptions={{ headerShown: false }}>
						<Stack.Screen name="(notes)" />
						<Stack.Screen name="(settings)" />
						<Stack.Screen name="(search)" />
					</Stack>
				</MobileSidebarProvider>
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
