import { Button, Host } from "@expo/ui"
import { Stack, useNavigation } from "expo-router"
import { Platform } from "react-native"

import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { SymbolName } from "@/components/ui/Symbol"

export interface HeaderAction {
	disabled?: boolean
	icon?: SymbolName
	label: string
	onPress: () => void
	primary?: boolean
}

export const CLOSE_ICON: SymbolName = { md: "close", sf: "xmark" }

const NOOP = () => undefined

function AndroidAction({ action }: { action: HeaderAction }) {
	if (action.icon) {
		return (
			<HeaderIconButton
				accessibilityLabel={action.label}
				icon={action.icon}
				onPress={action.disabled ? NOOP : action.onPress}
			/>
		)
	}
	return (
		<Host matchContents>
			<Button
				disabled={action.disabled}
				label={action.label}
				onPress={action.onPress}
				variant={action.primary ? "filled" : "text"}
			/>
		</Host>
	)
}

export function HeaderActions({ left, right }: { left?: HeaderAction; right?: HeaderAction }) {
	if (Platform.OS !== "ios") {
		return (
			<Stack.Screen
				options={{
					headerLeft: left ? () => <AndroidAction action={left} /> : undefined,
					headerRight: right ? () => <AndroidAction action={right} /> : undefined,
				}}
			/>
		)
	}
	return (
		<>
			{left ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button
						accessibilityLabel={left.label}
						disabled={left.disabled}
						icon={left.icon?.sf}
						onPress={left.onPress}
					>
						{left.icon ? undefined : left.label}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			{right ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						accessibilityLabel={right.label}
						disabled={right.disabled}
						icon={right.icon?.sf}
						onPress={right.onPress}
						variant={right.primary ? "prominent" : "plain"}
					>
						{right.icon ? undefined : right.label}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	)
}

export function useCloseSheetStack(): () => void {
	const navigation = useNavigation()
	return () => {
		const parent = navigation.getParent()
		if (parent?.canGoBack()) parent.goBack()
		else if (navigation.canGoBack()) navigation.goBack()
	}
}
