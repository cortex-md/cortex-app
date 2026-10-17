import { type Href, router, useNavigation } from "expo-router"

import type { AddVaultRoute } from "@/features/vault/addVaultContext"

export function pushAddVaultStep(route: AddVaultRoute): void {
	router.push(`/add-vault/${route}` as Href)
}

export function useCloseAddVault(): () => void {
	const navigation = useNavigation("/")
	return () => {
		if (navigation.canGoBack()) navigation.goBack()
	}
}
