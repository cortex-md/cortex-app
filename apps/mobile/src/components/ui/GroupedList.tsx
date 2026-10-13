import { ChevronRight } from "lucide-react-native"
import { Children, type ReactNode } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function GroupedSectionHeader({
	children,
	trailing,
}: {
	children: string
	trailing?: ReactNode
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.sectionHeader}>
			<Text style={[styles.sectionHeaderText, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
				{children}
			</Text>
			{trailing}
		</View>
	)
}

export function GroupedFooter({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.footer, { color: colors.secondaryLabel }]}>{children}</Text>
}

export function GroupedList({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	const items = Children.toArray(children).filter(Boolean)
	return (
		<View style={[styles.list, IS_IOS ? { backgroundColor: colors.cell } : null]}>
			{items.map((item, index) => (
				<View
					key={index}
					style={
						IS_IOS
							? null
							: [
									styles.m3Item,
									{ backgroundColor: colors.cell },
									index === 0 ? styles.m3First : null,
									index === items.length - 1 ? styles.m3Last : null,
								]
					}
				>
					{item}
					{IS_IOS && index < items.length - 1 ? (
						<View style={[styles.separator, { backgroundColor: colors.separator }]} />
					) : null}
				</View>
			))}
		</View>
	)
}

export function GroupedRow({
	accessibilityLabel,
	chevron = false,
	destructive = false,
	disabled = false,
	leading,
	onLongPress,
	onPress,
	subtitle,
	tint = false,
	title,
	trailing,
	value,
}: {
	accessibilityLabel?: string
	chevron?: boolean
	destructive?: boolean
	disabled?: boolean
	leading?: ReactNode
	onLongPress?: () => void
	onPress?: () => void
	subtitle?: string
	tint?: boolean
	title: string
	trailing?: ReactNode
	value?: string
}) {
	const { colors } = useMobileColors()
	const titleColor = destructive ? colors.destructiveText : tint ? colors.tint : colors.label

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			android_ripple={onPress ? { color: colors.hover } : undefined}
			disabled={disabled || !onPress}
			onLongPress={onLongPress}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
				disabled ? styles.disabled : null,
			]}
		>
			{leading ? <View style={styles.leading}>{leading}</View> : null}
			<View style={styles.rowBody}>
				<Text numberOfLines={1} style={[styles.title, { color: titleColor }]}>
					{title}
				</Text>
				{subtitle || (!IS_IOS && value) ? (
					<Text numberOfLines={2} style={[styles.subtitle, { color: colors.secondaryLabel }]}>
						{subtitle ?? value}
					</Text>
				) : null}
			</View>
			{IS_IOS && value ? (
				<Text numberOfLines={1} style={[styles.value, { color: colors.secondaryLabel }]}>
					{value}
				</Text>
			) : null}
			{trailing}
			{chevron ? <ChevronRight color={colors.tertiaryLabel} size={IS_IOS ? 14 : 24} strokeWidth={2.4} /> : null}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	disabled: {
		opacity: 0.4,
	},
	footer: {
		fontSize: IS_IOS ? 13 : 12,
		letterSpacing: IS_IOS ? 0 : 0.4,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 8,
	},
	leading: {
		alignItems: "center",
		justifyContent: "center",
	},
	list: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 0,
		gap: IS_IOS ? 0 : 2,
		marginHorizontal: 16,
		overflow: "hidden",
	},
	m3First: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
	},
	m3Item: {
		borderCurve: "continuous",
		borderRadius: 4,
		overflow: "hidden",
	},
	m3Last: {
		borderBottomLeftRadius: 20,
		borderBottomRightRadius: 20,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	rowBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	sectionHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 20,
	},
	sectionHeaderText: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 18 : 20,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 16,
	},
	subtitle: {
		fontSize: IS_IOS ? 13 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: IS_IOS ? 18 : 20,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
	},
	value: {
		fontSize: 17,
		lineHeight: 22,
		maxWidth: "45%",
	},
})
