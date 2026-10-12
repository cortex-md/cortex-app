import type { LucideIcon } from "lucide-react-native"
import { Pressable, StyleSheet, Text } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function SheetActionButton({
	Icon,
	destructive,
	disabled,
	label,
	onPress,
}: {
	Icon: LucideIcon
	destructive?: boolean
	disabled?: boolean
	label: string
	onPress: () => void
}) {
	const { colors, iconColors } = useMobileColors()
	const color = destructive ? colors.destructive : iconColors.tint

	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.sheetAction,
				{
					borderColor: colors.separator,
					opacity: disabled ? 0.42 : pressed ? 0.62 : 1,
				},
			]}
		>
			<Icon color={color as string} size={19} strokeWidth={2.25} />
			<Text
				style={[styles.sheetActionText, { color: destructive ? colors.destructive : colors.label }]}
			>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	sheetAction: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		minHeight: 44,
		paddingHorizontal: 12,
	},
	sheetActionText: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
	},
})
