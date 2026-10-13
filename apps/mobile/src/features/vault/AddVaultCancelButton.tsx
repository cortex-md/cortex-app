import { Stack } from "expo-router"
import { Platform } from "react-native"

import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { useCloseAddVault } from "@/features/vault/addVaultNavigation"

export function AddVaultCancelButton() {
	const close = useCloseAddVault()
	if (Platform.OS === "ios") {
		return (
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button onPress={close}>Cancel</Stack.Toolbar.Button>
			</Stack.Toolbar>
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
			}}
		/>
	)
}
