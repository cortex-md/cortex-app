import { usePluginStore } from "@cortex/plugin-host-core"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { PluginView } from "@/features/plugins/PluginView"
import { useMobileColors } from "@/hooks/useMobileColors"

export function PluginModalHost() {
	const modalInstances = usePluginStore((state) => state.modalInstances)
	const views = usePluginStore((state) => state.views)
	const { colors } = useMobileColors()

	return modalInstances.map((modal) => {
		const registration = views.find((view) => view.key === modal.viewKey)
		if (!registration) return null
		return (
			<Modal
				animationType="slide"
				key={modal.id}
				onRequestClose={() => mobilePluginHost.closeModal(modal.id)}
				presentationStyle="pageSheet"
				visible
			>
				<View style={[styles.sheet, { backgroundColor: colors.background }]}>
					<View style={[styles.header, { borderColor: colors.separator }]}>
						<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
							{modal.title ?? registration.label}
						</Text>
						<Pressable
							accessibilityRole="button"
							hitSlop={8}
							onPress={() => mobilePluginHost.closeModal(modal.id)}
							style={({ pressed }) => ({ opacity: pressed ? 0.52 : 1 })}
						>
							<Text style={[styles.done, { color: colors.tint }]}>Done</Text>
						</Pressable>
					</View>
					<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
						<PluginView
							onStateChange={(nextState) => mobilePluginHost.updateModalState(modal.id, nextState)}
							registration={registration}
							state={modal.state}
						/>
					</ScrollView>
				</View>
			</Modal>
		)
	})
}

const styles = StyleSheet.create({
	content: {
		gap: 12,
		padding: 16,
	},
	done: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	header: {
		alignItems: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 12,
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	sheet: {
		flex: 1,
	},
	title: {
		flex: 1,
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
})
