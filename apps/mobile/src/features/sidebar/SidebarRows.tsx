import { Platform, Pressable, StyleSheet, Text } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const NAV_ROW_HEIGHT = IS_IOS ? 44 : 56

export function SidebarRow({
	badge,
	icon,
	label,
	onPress,
	trailing,
}: {
	badge?: string
	icon: SymbolName
	label: string
	onPress: () => void
	trailing?: string
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
			]}
		>
			<SymbolIcon
				color={IS_IOS ? colors.tint : colors.secondaryLabel}
				name={icon}
				size={IS_IOS ? 20 : 24}
			/>
			<Text numberOfLines={1} style={[styles.rowLabel, { color: colors.label }]}>
				{label}
			</Text>
			{badge ? <Badge destructive label={badge} /> : null}
			{trailing ? (
				<Text style={[styles.rowTrailing, { color: colors.secondaryLabel }]}>{trailing}</Text>
			) : null}
		</Pressable>
	)
}

export function SidebarSectionHeader({ label }: { label: string }) {
	const { colors } = useMobileColors()
	return (
		<Text
			accessibilityRole="header"
			style={[styles.sectionLabel, { color: colors.secondaryLabel }]}
		>
			{label}
		</Text>
	)
}

const styles = StyleSheet.create({
	row: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 10 : 999,
		flexDirection: "row",
		gap: 12,
		minHeight: NAV_ROW_HEIGHT,
		overflow: "hidden",
		paddingHorizontal: IS_IOS ? 12 : 16,
	},
	rowLabel: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 22 : 20,
	},
	rowTrailing: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	sectionLabel: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: IS_IOS ? "600" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: 20,
		paddingBottom: 6,
		paddingHorizontal: IS_IOS ? 12 : 16,
		paddingTop: 16,
	},
})
