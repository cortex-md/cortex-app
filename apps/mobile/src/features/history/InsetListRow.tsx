import type { ReactNode } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const OUTER_RADIUS = IS_IOS ? 26 : 20
const INNER_RADIUS = IS_IOS ? 0 : 4

export function InsetSectionHeader({ title }: { title: string }) {
	const { colors } = useMobileColors()
	return (
		<Text style={[styles.header, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
			{IS_IOS ? title.toUpperCase() : title}
		</Text>
	)
}

export function InsetListRow({
	children,
	chevron = false,
	first,
	last,
	leading,
	onLongPress,
	onPress,
	subtitle,
	title,
	trailing,
}: {
	children?: ReactNode
	chevron?: boolean
	first: boolean
	last: boolean
	leading?: ReactNode
	onLongPress?: () => void
	onPress?: () => void
	subtitle?: string
	title: string
	trailing?: ReactNode
}) {
	const { colors } = useMobileColors()
	return (
		<View
			style={[
				styles.cell,
				{
					backgroundColor: colors.cell,
					borderBottomLeftRadius: last ? OUTER_RADIUS : INNER_RADIUS,
					borderBottomRightRadius: last ? OUTER_RADIUS : INNER_RADIUS,
					borderTopLeftRadius: first ? OUTER_RADIUS : INNER_RADIUS,
					borderTopRightRadius: first ? OUTER_RADIUS : INNER_RADIUS,
					marginBottom: !IS_IOS && !last ? 2 : 0,
				},
			]}
		>
			<Pressable
				accessibilityRole={onPress ? "button" : undefined}
				android_ripple={onPress ? { color: colors.hover } : undefined}
				disabled={!onPress && !onLongPress}
				onLongPress={onLongPress}
				onPress={onPress}
				style={({ pressed }) => [
					styles.row,
					{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
				]}
			>
				{leading ? <View style={styles.leading}>{leading}</View> : null}
				<View style={styles.body}>
					<Text numberOfLines={2} style={[styles.title, { color: colors.label }]}>
						{title}
					</Text>
					{subtitle ? (
						<Text numberOfLines={2} style={[styles.subtitle, { color: colors.secondaryLabel }]}>
							{subtitle}
						</Text>
					) : null}
					{children}
				</View>
				{trailing}
				{chevron ? (
					<Symbol
						color={colors.tertiaryLabel}
						name={{ sf: "chevron.right", md: "chevron_right" }}
						size={IS_IOS ? 13 : 24}
					/>
				) : null}
			</Pressable>
			{IS_IOS && !last ? (
				<View
					style={[
						styles.separator,
						{ backgroundColor: colors.separator, marginLeft: leading ? 58 : 16 },
					]}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	body: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	cell: {
		borderCurve: "continuous",
		marginHorizontal: 16,
		overflow: "hidden",
	},
	header: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		lineHeight: IS_IOS ? 18 : 20,
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 20,
	},
	leading: {
		alignItems: "center",
		justifyContent: "center",
		width: 30,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 52 : 64,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
	},
	subtitle: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
})
