import { router, useLocalSearchParams } from "expo-router"

import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen"

function first(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

export function OnboardingRoute() {
	const params = useLocalSearchParams<{ path?: string | string[]; name?: string | string[] }>()
	const path = first(params.path)
	const defaultName = first(params.name) ?? ""

	function close() {
		if (router.canGoBack()) router.back()
	}

	return (
		<OnboardingScreen
			initialFolder={path ? { defaultName, path } : null}
			key={path ?? "new"}
			onCancel={close}
			onCreated={close}
		/>
	)
}
