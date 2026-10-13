import { Check, ChevronDown, X } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text } from "react-native"

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
			{!IS_IOS && selected ? <Check color={foreground} size={18} strokeWidth={2.4} /> : null}
			<Text numberOfLines={1} style={[styles.label, { color: foreground }]}>
				{label}
			</Text>
			{onRemove ? (
				<X color={foreground} size={16} strokeWidth={2.4} />
			) : menu ? (
				<ChevronDown color={foreground} size={16} strokeWidth={2.4} />
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
