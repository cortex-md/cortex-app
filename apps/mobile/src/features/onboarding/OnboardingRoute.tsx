import { router, Stack, useLocalSearchParams } from "expo-router"
import { Platform } from "react-native"

import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen"

function first(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

function close() {
	if (router.canGoBack()) router.back()
}

function OnboardingRouteChrome({ title }: { title: string }) {
	if (Platform.OS === "ios") {
		return (
			<>
				<Stack.Screen options={{ title }} />
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={close}>Cancel</Stack.Toolbar.Button>
				</Stack.Toolbar>
			</>
		)
	}
	return (
		<Stack.Screen
			options={{
				headerLeft: () => (
					<HeaderIconButton
						accessibilityLabel="Cancel"
						icon={{ md: "close", sf: "xmark" }}
						onPress={close}
					/>
				),
				title,
			}}
		/>
	)
}

export function OnboardingRoute() {
	const params = useLocalSearchParams<{ path?: string | string[]; name?: string | string[] }>()
	const path = first(params.path)
	const name = first(params.name) ?? ""

	return (
		<OnboardingScreen
			initialFolder={path ? { name, path } : null}
			key={path ?? "new"}
			onCreated={close}
			renderChrome={(title) => <OnboardingRouteChrome title={title} />}
		/>
	)
}
