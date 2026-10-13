import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated"

import { dismissToast, useToastState } from "@/features/feedback/toastStore"
import { useMobileColors } from "@/hooks/useMobileColors"

const SNACKBAR_BOTTOM_OFFSET = 96

export function ToastHost() {
	const toast = useToastState()
	const { colors } = useMobileColors()
	if (!toast) return null

	return (
		<View pointerEvents="box-none" style={styles.host}>
			<Animated.View
				entering={FadeInDown.duration(200)}
				exiting={FadeOutDown.duration(160)}
				key={toast.id}
				style={[styles.snackbar, { backgroundColor: colors.inverseSurface }]}
			>
				<Text numberOfLines={2} style={[styles.message, { color: colors.inverseOnSurface }]}>
					{toast.message}
				</Text>
				{toast.action ? (
					<Pressable
						android_ripple={{ color: colors.accentSubtle }}
						hitSlop={8}
						onPress={() => {
							toast.action?.onPress()
							dismissToast(toast.id)
						}}
						style={styles.actionButton}
					>
						<Text style={[styles.action, { color: colors.tintFill }]}>{toast.action.label}</Text>
					</Pressable>
				) : null}
			</Animated.View>
		</View>
	)
}

const styles = StyleSheet.create({
	action: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	actionButton: {
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	host: {
		bottom: SNACKBAR_BOTTOM_OFFSET,
		left: 16,
		position: "absolute",
		right: 16,
	},
	message: {
		flex: 1,
		fontSize: 14,
		letterSpacing: 0.25,
		lineHeight: 20,
	},
	snackbar: {
		alignItems: "center",
		borderRadius: 4,
		flexDirection: "row",
		gap: 8,
		minHeight: 48,
		paddingLeft: 16,
		paddingRight: 8,
		paddingVertical: 6,
	},
})
