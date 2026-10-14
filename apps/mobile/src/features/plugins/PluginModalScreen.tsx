import { usePluginStore } from "@cortex/plugin-host-core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect } from "react"
import { Platform, ScrollView, StyleSheet } from "react-native"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { readParam } from "@/features/history/useVersionHistory"
import { PluginView } from "@/features/plugins/PluginView"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function close(): void {
	if (router.canGoBack()) router.back()
}

export function PluginModalScreen() {
	const params = useLocalSearchParams<{ modalId?: string | string[] }>()
	const modalId = readParam(params.modalId)
	const modal = usePluginStore((state) => state.modalInstances.find((item) => item.id === modalId))
	const registration = usePluginStore((state) =>
		modal ? state.views.find((view) => view.key === modal.viewKey) : undefined,
	)
	const { colors } = useMobileColors()
	const open = Boolean(modal)

	useEffect(() => {
		if (!open) close()
	}, [open])

	useEffect(
		() => () => {
			if (!modalId) return
			const stillOpen = usePluginStore.getState().modalInstances.some((item) => item.id === modalId)
			if (stillOpen) mobilePluginHost.closeModal(modalId)
		},
		[modalId],
	)

	if (!modal || !registration) return null

	return (
		<>
			<Stack.Screen
				options={{
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Done"
									icon={{ md: "check", sf: "checkmark" }}
									onPress={close}
								/>
							),
					title: modal.title ?? registration.label,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button onPress={close}>Done</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				style={{ backgroundColor: colors.background }}
			>
				<PluginView
					onStateChange={(nextState) => mobilePluginHost.updateModalState(modal.id, nextState)}
					registration={registration}
					state={modal.state}
				/>
			</ScrollView>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 12,
		padding: 16,
	},
})
