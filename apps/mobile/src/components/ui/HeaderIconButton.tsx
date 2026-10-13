import { Platform, Pressable, StyleSheet } from "react-native"

import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function HeaderIconButton({
	accessibilityLabel,
	icon,
	onPress,
	prominent = false,
}: {
	accessibilityLabel: string
	icon: SymbolName
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
			<SymbolIcon
				color={prominent && IS_IOS ? colors.onTint : IS_IOS ? colors.label : colors.secondaryLabel}
				name={icon}
				size={IS_IOS ? 20 : 24}
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
