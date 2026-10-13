import type { LucideIcon } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export interface TemplateHeaderAction {
	label: string
	Icon?: LucideIcon
	onPress: () => void
	disabled?: boolean
	prominent?: boolean
	iosText?: boolean
}

function IosAction({ action }: { action: TemplateHeaderAction }) {
	const { colors } = useMobileColors()
	const showText = action.iosText || !action.Icon
	const background = action.prominent ? colors.tintFill : colors.fill
	const foreground = action.prominent ? colors.onTint : colors.label
	const Icon = action.Icon

	return (
		<Pressable
			accessibilityLabel={action.label}
			accessibilityRole="button"
			disabled={action.disabled}
			onPress={action.onPress}
			style={({ pressed }) => [
				showText ? styles.iosPill : styles.iosCircle,
				{ backgroundColor: background, opacity: pressed || action.disabled ? 0.6 : 1 },
			]}
		>
			{showText || !Icon ? (
				<Text
					numberOfLines={1}
					style={[styles.iosLabel, { color: foreground }, action.prominent ? styles.bold : null]}
				>
					{action.label}
				</Text>
			) : (
				<Icon color={foreground} size={20} strokeWidth={2.2} />
			)}
		</Pressable>
	)
}

function AndroidAction({ action }: { action: TemplateHeaderAction }) {
	const { colors } = useMobileColors()
	if (action.prominent || !action.Icon) {
		return (
			<Pressable
				accessibilityLabel={action.label}
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				disabled={action.disabled}
				onPress={action.onPress}
				style={[
					styles.m3Filled,
					{ backgroundColor: colors.tintFill, opacity: action.disabled ? 0.6 : 1 },
				]}
			>
				<Text style={[styles.m3FilledLabel, { color: colors.onTint }]}>{action.label}</Text>
			</Pressable>
		)
	}
	const Icon = action.Icon
	return (
		<Pressable
			accessibilityLabel={action.label}
			accessibilityRole="button"
			android_ripple={{ borderless: true, color: colors.hover }}
			disabled={action.disabled}
			onPress={action.onPress}
			style={styles.m3Icon}
		>
			<Icon color={colors.secondaryLabel} size={24} strokeWidth={2} />
		</Pressable>
	)
}

export function TemplateSheetHeader({
	leading,
	title,
	trailing,
}: {
	leading: TemplateHeaderAction
	title: string
	trailing?: TemplateHeaderAction
}) {
	const { colors } = useMobileColors()

	if (!IS_IOS) {
		return (
			<View style={styles.m3Header}>
				<AndroidAction action={leading} />
				<Text numberOfLines={1} style={[styles.m3Title, { color: colors.label }]}>
					{title}
				</Text>
				{trailing ? <AndroidAction action={trailing} /> : null}
			</View>
		)
	}

	return (
		<View style={styles.header}>
			<View style={styles.side}>
				<IosAction action={leading} />
			</View>
			<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
				{title}
			</Text>
			<View style={[styles.side, styles.sideEnd]}>
				{trailing ? <IosAction action={trailing} /> : null}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	bold: {
		fontWeight: "600",
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: 60,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	iosCircle: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	iosLabel: {
		fontSize: 17,
		lineHeight: 22,
	},
	iosPill: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	m3Filled: {
		alignItems: "center",
		borderRadius: 999,
		height: 40,
		justifyContent: "center",
		marginRight: 8,
		paddingHorizontal: 24,
	},
	m3FilledLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	m3Header: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		minHeight: 64,
		paddingHorizontal: 4,
	},
	m3Icon: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	m3Title: {
		flex: 1,
		fontSize: 22,
		lineHeight: 28,
		marginLeft: 4,
	},
	side: {
		flexDirection: "row",
		minWidth: 96,
	},
	sideEnd: {
		justifyContent: "flex-end",
	},
	title: {
		flex: 1,
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
})
