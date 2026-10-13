import type { ReactNode } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function ListCell({
	accessibilityLabel,
	children,
	first,
	last,
	onLongPress,
	onPress,
	separatorInset = 16,
}: {
	accessibilityLabel?: string
	children: ReactNode
	first: boolean
	last: boolean
	onLongPress?: () => void
	onPress?: () => void
	separatorInset?: number
}) {
	const { colors } = useMobileColors()
	return (
		<View
			style={[
				styles.cell,
				{ backgroundColor: colors.cell },
				first ? styles.first : null,
				last ? styles.last : null,
			]}
		>
			<Pressable
				accessibilityLabel={accessibilityLabel}
				accessibilityRole="button"
				android_ripple={onPress ? { color: colors.hover } : undefined}
				disabled={!onPress && !onLongPress}
				onLongPress={onLongPress}
				onPress={onPress}
				style={({ pressed }) => [
					styles.row,
					{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
				]}
			>
				{children}
			</Pressable>
			{IS_IOS && !last ? (
				<View
					style={[
						styles.separator,
						{ backgroundColor: colors.separator, marginLeft: separatorInset },
					]}
				/>
			) : null}
		</View>
	)
}

export function ListSectionHeader({ children }: { children: string }) {
	const { colors } = useMobileColors()
	return (
		<Text style={[styles.header, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
			{children}
		</Text>
	)
}

export const listCellStyles = StyleSheet.create({
	body: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	subtitle: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	value: {
		fontSize: IS_IOS ? 15 : 14,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
	},
})

const styles = StyleSheet.create({
	cell: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 0 : 4,
		marginBottom: IS_IOS ? 0 : 2,
		marginHorizontal: 16,
		overflow: "hidden",
	},
	first: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	header: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		lineHeight: IS_IOS ? 18 : 20,
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 20,
	},
	last: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
	},
})
