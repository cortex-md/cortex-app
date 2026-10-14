import { Platform, Pressable, StyleSheet, Text } from "react-native"

import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function HeaderIconButton({
	accessibilityLabel,
	badge,
	icon,
	onPress,
	prominent = false,
}: {
	accessibilityLabel: string
	badge?: string
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
			{badge ? (
				<Text style={[styles.badge, { backgroundColor: colors.destructive, color: colors.onTint }]}>
					{badge}
				</Text>
			) : null}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	badge: {
		borderRadius: 8,
		fontSize: 11,
		fontWeight: "600",
		lineHeight: 16,
		minWidth: 16,
		overflow: "hidden",
		paddingHorizontal: 4,
		position: "absolute",
		right: 6,
		textAlign: "center",
		top: 6,
	},
	button: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 44 : 48,
		justifyContent: "center",
		width: IS_IOS ? 44 : 48,
	},
})
