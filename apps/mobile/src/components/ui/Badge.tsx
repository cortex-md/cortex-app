import { StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function Badge({
	destructive = false,
	label,
	tint = false,
}: {
	destructive?: boolean
	label: string
	tint?: boolean
}) {
	const { colors } = useMobileColors()
	const backgroundColor = destructive
		? colors.destructive
		: tint
			? colors.accentSubtle
			: colors.fill
	const color = destructive ? colors.onDestructive : tint ? colors.tint : colors.secondaryLabel

	return (
		<View style={[styles.badge, { backgroundColor }]}>
			<Text style={[styles.label, { color }]}>{label}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	badge: {
		alignItems: "center",
		borderRadius: 999,
		height: 22,
		justifyContent: "center",
		minWidth: 22,
		paddingHorizontal: 8,
	},
	label: {
		fontSize: 12,
		fontVariant: ["tabular-nums"],
		fontWeight: "600",
		lineHeight: 16,
	},
})
