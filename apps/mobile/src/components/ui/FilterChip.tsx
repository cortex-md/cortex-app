import { Platform, Pressable, StyleSheet, Text } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function FilterChip({
	accessibilityLabel,
	label,
	menu = false,
	onPress,
	onRemove,
	selected = false,
}: {
	accessibilityLabel?: string
	label: string
	menu?: boolean
	onPress?: () => void
	onRemove?: () => void
	selected?: boolean
}) {
	const { colors } = useMobileColors()
	const foreground = selected ? colors.tint : colors.secondaryLabel

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			android_ripple={{ color: colors.hover }}
			onPress={onRemove ?? onPress}
			style={({ pressed }) => [
				styles.chip,
				{
					backgroundColor: selected ? colors.accentSubtle : IS_IOS ? colors.fill : "transparent",
					borderColor: selected || IS_IOS ? "transparent" : colors.tertiaryLabel,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			{!IS_IOS && selected ? (
				<Symbol color={foreground} name={{ sf: "checkmark", md: "check" }} size={18} />
			) : null}
			<Text numberOfLines={1} style={[styles.label, { color: foreground }]}>
				{label}
			</Text>
			{onRemove ? (
				<Symbol color={foreground} name={{ sf: "xmark", md: "close" }} size={16} />
			) : menu ? (
				<Symbol
					color={foreground}
					name={{ sf: "chevron.down", md: "keyboard_arrow_down" }}
					size={16}
				/>
			) : null}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	chip: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 999 : 8,
		borderWidth: IS_IOS ? 0 : StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 6,
		height: 32,
		paddingHorizontal: IS_IOS ? 12 : 14,
	},
	label: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: 20,
	},
})
