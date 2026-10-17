import { Button, Host } from "@expo/ui"
import { Stack } from "expo-router"
import { Platform } from "react-native"

import { HeaderIconButton } from "@/components/ui/HeaderIconButton"

const IS_IOS = Platform.OS === "ios"

export function SheetToolbar({
	confirmDisabled = false,
	confirmLabel,
	onCancel,
	onConfirm,
	title,
}: {
	confirmDisabled?: boolean
	confirmLabel?: string
	onCancel: () => void
	onConfirm?: () => void
	title: string
}) {
	if (IS_IOS) {
		return (
			<>
				<Stack.Screen options={{ title }} />
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={onCancel}>Cancel</Stack.Toolbar.Button>
				</Stack.Toolbar>
				{confirmLabel && onConfirm ? (
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Button disabled={confirmDisabled} onPress={onConfirm} variant="done">
							{confirmLabel}
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				) : null}
			</>
		)
	}
	return (
		<Stack.Screen
			options={{
				headerLeft: () => (
					<HeaderIconButton
						accessibilityLabel="Close"
						icon={{ sf: "xmark", md: "close" }}
						onPress={onCancel}
					/>
				),
				headerRight:
					confirmLabel && onConfirm
						? () => (
								<Host matchContents>
									<Button
										disabled={confirmDisabled}
										label={confirmLabel}
										onPress={onConfirm}
										variant="text"
									/>
								</Host>
							)
						: undefined,
				title,
			}}
		/>
	)
}
