import { ArrowLeft, ChevronLeft, type LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function OnboardingTopBar({
	onBack,
	trailing,
}: {
	onBack?: () => void
	trailing?: ReactNode
}) {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	return (
		<View style={[styles.topBar, { paddingTop: insets.top + (IS_IOS ? 4 : 0) }]}>
			{onBack ? (
				<Pressable
					accessibilityLabel="Back"
					accessibilityRole="button"
					android_ripple={{ borderless: true, color: colors.hover }}
					onPress={onBack}
					style={({ pressed }) => [
						IS_IOS ? styles.glassButton : styles.iconButton,
						IS_IOS
							? { backgroundColor: colors.glass, borderColor: colors.glassEdge }
							: null,
						{ opacity: pressed ? 0.6 : 1 },
					]}
				>
					{IS_IOS ? (
						<ChevronLeft color={colors.label} size={24} strokeWidth={2.2} />
					) : (
						<ArrowLeft color={colors.label} size={24} strokeWidth={2} />
					)}
				</Pressable>
			) : (
				<View />
			)}
			{trailing}
		</View>
	)
}

export function OnboardingTitle({ subtitle, title }: { subtitle?: string; title: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.titleBlock}>
			<Text accessibilityRole="header" style={[styles.title, { color: colors.label }]}>
				{title}
			</Text>
			{subtitle ? (
				<Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>{subtitle}</Text>
			) : null}
		</View>
	)
}

export function OnboardingButton({
	Icon,
	busy = false,
	disabled = false,
	label,
	onPress,
	variant,
}: {
	Icon?: LucideIcon
	busy?: boolean
	disabled?: boolean
	label: string
	onPress: () => void
	variant: "primary" | "secondary" | "plain"
}) {
	const { colors } = useMobileColors()
	const background =
		variant === "primary" ? colors.tintFill : variant === "secondary" && IS_IOS ? colors.fill : "transparent"
	const foreground = variant === "primary" ? colors.onTint : variant === "plain" ? colors.tint : IS_IOS ? colors.label : colors.tint
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ busy, disabled }}
			android_ripple={{ color: colors.hover }}
			disabled={disabled || busy}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				{
					backgroundColor: background,
					borderColor: variant === "secondary" && !IS_IOS ? colors.tertiaryLabel : "transparent",
					opacity: disabled ? 0.4 : pressed && IS_IOS ? 0.75 : 1,
				},
			]}
		>
			{busy ? (
				<ActivityIndicator color={foreground} />
			) : Icon ? (
				<Icon color={foreground} size={20} strokeWidth={2} />
			) : null}
			<Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
		</Pressable>
	)
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ borderless: true, color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				IS_IOS ? styles.glassTextButton : styles.textButton,
				IS_IOS ? { backgroundColor: colors.glass, borderColor: colors.glassEdge } : null,
				{ opacity: pressed ? 0.6 : 1 },
			]}
		>
			<Text style={[styles.textButtonLabel, { color: IS_IOS ? colors.label : colors.tint }]}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 999,
		borderWidth: IS_IOS ? 0 : 1,
		flexDirection: "row",
		gap: 8,
		height: IS_IOS ? 52 : 56,
		justifyContent: "center",
		paddingHorizontal: IS_IOS ? 22 : 28,
	},
	buttonLabel: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: IS_IOS ? "600" : "500",
		letterSpacing: IS_IOS ? 0 : 0.15,
		lineHeight: IS_IOS ? 22 : 24,
	},
	glassButton: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	glassTextButton: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		height: 44,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	iconButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	subtitle: {
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
	},
	textButton: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	textButtonLabel: {
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 22 : 20,
	},
	title: {
		fontSize: IS_IOS ? 34 : 24,
		fontWeight: IS_IOS ? "700" : "400",
		letterSpacing: IS_IOS ? 0.4 : 0,
		lineHeight: IS_IOS ? 41 : 32,
	},
	titleBlock: {
		gap: IS_IOS ? 6 : 8,
		paddingBottom: 8,
		paddingHorizontal: IS_IOS ? 20 : 16,
		paddingTop: IS_IOS ? 4 : 12,
	},
	topBar: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		minHeight: IS_IOS ? 52 : 64,
		paddingHorizontal: IS_IOS ? 16 : 4,
	},
})
