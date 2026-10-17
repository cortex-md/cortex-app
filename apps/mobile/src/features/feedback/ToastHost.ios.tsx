import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated"

import { dismissToast, useToastState } from "@/features/feedback/toastStore"
import { useToastBottomOffset } from "@/features/feedback/useToastBottomOffset"
import { useMobileColors } from "@/hooks/useMobileColors"

export function ToastHost() {
	const toast = useToastState()
	const { colors } = useMobileColors()
	const bottom = useToastBottomOffset()
	if (!toast) return null

	return (
		<View pointerEvents="box-none" style={[styles.host, { bottom }]}>
			<Animated.View
				entering={FadeInDown.duration(220)}
				exiting={FadeOutDown.duration(180)}
				key={toast.id}
				style={[
					styles.toast,
					{
						backgroundColor: colors.glass,
						borderColor: colors.glassEdge,
						boxShadow: `0 8px 40px ${colors.shadow}`,
					},
				]}
			>
				<Text numberOfLines={2} style={[styles.message, { color: colors.label }]}>
					{toast.message}
				</Text>
				{toast.action ? (
					<Pressable
						hitSlop={8}
						onPress={() => {
							toast.action?.onPress()
							dismissToast(toast.id)
						}}
					>
						<Text style={[styles.action, { color: colors.tint }]}>{toast.action.label}</Text>
					</Pressable>
				) : null}
			</Animated.View>
		</View>
	)
}

const styles = StyleSheet.create({
	action: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	host: {
		alignItems: "center",
		left: 20,
		position: "absolute",
		right: 20,
		zIndex: 100,
	},
	message: {
		flexShrink: 1,
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
	},
	toast: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 14,
		maxWidth: "100%",
		minHeight: 48,
		paddingHorizontal: 18,
		paddingVertical: 12,
	},
})
