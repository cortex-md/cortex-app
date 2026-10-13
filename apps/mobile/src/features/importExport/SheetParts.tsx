import { Button, Host } from "@expo/ui"
import { Check, type LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export type SheetButtonVariant = "filled" | "gray" | "plain"

const universalVariant: Record<SheetButtonVariant, "filled" | "outlined" | "text"> = {
	filled: "filled",
	gray: "outlined",
	plain: "text",
}

export function SheetButton({
	disabled = false,
	label,
	onPress,
	variant = "filled",
}: {
	disabled?: boolean
	label: string
	onPress: () => void
	variant?: SheetButtonVariant
}) {
	return (
		<Host matchContents style={styles.buttonHost}>
			<Button
				disabled={disabled}
				label={label}
				onPress={onPress}
				style={{ height: IS_IOS ? 50 : 48 }}
				variant={universalVariant[variant]}
			/>
		</Host>
	)
}

export function SheetHero({
	Icon = Check,
	subtitle,
	tint = false,
	title,
}: {
	Icon?: LucideIcon
	subtitle: string
	tint?: boolean
	title: string
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.hero}>
			<View
				style={[
					styles.heroIcon,
					{ backgroundColor: tint ? colors.accentSubtle : colors.successBackground },
				]}
			>
				<Icon color={tint ? colors.tint : colors.successText} size={26} strokeWidth={2.4} />
			</View>
			<Text style={[styles.heroTitle, { color: colors.label }]}>{title}</Text>
			<Text style={[styles.heroSubtitle, { color: colors.secondaryLabel }]}>{subtitle}</Text>
		</View>
	)
}

export function KeyValueRow({
	label,
	subtitle,
	value,
}: {
	label: string
	subtitle?: string
	value: string
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.kvRow}>
			<View style={styles.kvBody}>
				<Text style={[styles.kvLabel, { color: colors.label }]}>{label}</Text>
				{subtitle ? (
					<Text numberOfLines={2} style={[styles.kvSubtitle, { color: colors.secondaryLabel }]}>
						{subtitle}
					</Text>
				) : null}
			</View>
			<Text style={[styles.kvValue, { color: colors.secondaryLabel }]}>{value}</Text>
		</View>
	)
}

export function SheetBody({
	children,
	style,
}: {
	children: ReactNode
	style?: { paddingBottom?: number }
}) {
	return <View style={[styles.body, style]}>{children}</View>
}

export function SheetBottomBar({ children }: { children: ReactNode }) {
	return <View style={styles.bottomBar}>{children}</View>
}

const styles = StyleSheet.create({
	body: {
		paddingBottom: 40,
	},
	bottomBar: {
		bottom: IS_IOS ? 34 : 24,
		left: 16,
		position: "absolute",
		right: 16,
	},
	buttonHost: {
		marginHorizontal: 16,
	},
	hero: {
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 28,
		paddingVertical: 12,
	},
	heroIcon: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 18,
		height: 56,
		justifyContent: "center",
		width: 56,
	},
	heroSubtitle: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: IS_IOS ? 20 : 20,
		textAlign: "center",
	},
	heroTitle: {
		fontSize: IS_IOS ? 22 : 24,
		fontWeight: IS_IOS ? "700" : "400",
		lineHeight: IS_IOS ? 28 : 32,
		textAlign: "center",
	},
	kvBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	kvLabel: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	kvRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	kvSubtitle: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	kvValue: {
		fontSize: IS_IOS ? 17 : 14,
		fontVariant: ["tabular-nums"],
		lineHeight: IS_IOS ? 22 : 20,
	},
})
