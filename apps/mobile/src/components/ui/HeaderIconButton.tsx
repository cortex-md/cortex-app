import type { LucideIcon } from "lucide-react-native"
import { Platform, Pressable, StyleSheet } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function HeaderIconButton({
	Icon,
	accessibilityLabel,
	onPress,
	prominent = false,
}: {
	Icon: LucideIcon
	accessibilityLabel: string
	onPress: () => void
	prominent?: boolean
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			android_ripple={{ borderless: true, color: colors.hover }}
			hitSlop={4}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				IS_IOS
					? {
							backgroundColor: prominent ? colors.tintFill : colors.glass,
							borderColor: prominent ? "transparent" : colors.glassEdge,
							borderWidth: StyleSheet.hairlineWidth,
						}
					: null,
				{ opacity: pressed ? 0.6 : 1 },
			]}
		>
			<Icon
				color={prominent && IS_IOS ? colors.onTint : IS_IOS ? colors.label : colors.secondaryLabel}
				size={IS_IOS ? 20 : 24}
				strokeWidth={2.1}
			/>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 44 : 48,
		justifyContent: "center",
		width: IS_IOS ? 44 : 48,
	},
})
