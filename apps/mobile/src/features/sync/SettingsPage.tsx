import { Button, type ButtonVariant, FieldGroup, Host } from "@expo/ui"
import type { ReactNode } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function SettingsPage({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
	const { colors } = useMobileColors()
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			keyboardDismissMode="on-drag"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			{subtitle ? <PageSubtitle>{subtitle}</PageSubtitle> : null}
			{children}
		</ScrollView>
	)
}

export function PageSubtitle({ children }: { children: string }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>{children}</Text>
}

export function SettingsGroup({ children }: { children: ReactNode }) {
	return (
		<Host matchContents style={styles.host}>
			<FieldGroup>{children}</FieldGroup>
		</Host>
	)
}

export function SettingsBlock({
	children,
	title,
	trailing,
}: {
	children: ReactNode
	title?: string
	trailing?: ReactNode
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.block}>
			{title ? (
				<View style={styles.blockHeader}>
					<Text style={[styles.blockTitle, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
						{IS_IOS ? title.toUpperCase() : title}
					</Text>
					{trailing}
				</View>
			) : null}
			{children}
		</View>
	)
}

export function SettingsCard({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return <View style={[styles.card, { backgroundColor: colors.cell }]}>{children}</View>
}

export function SettingsFooterText({ children }: { children: string }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.footer, { color: colors.secondaryLabel }]}>{children}</Text>
}

export function ActionButton({
	disabled = false,
	label,
	onPress,
	variant = "filled",
	wide = false,
}: {
	disabled?: boolean
	label: string
	onPress: () => void
	variant?: ButtonVariant
	wide?: boolean
}) {
	return (
		<Host matchContents style={wide ? styles.wideButton : undefined}>
			<Button
				disabled={disabled}
				label={label}
				onPress={onPress}
				style={wide ? { width: "100%" } : undefined}
				variant={variant}
			/>
		</Host>
	)
}

const styles = StyleSheet.create({
	block: {
		marginTop: 20,
	},
	blockHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
	},
	blockTitle: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 18 : 20,
	},
	card: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		overflow: "hidden",
		padding: 16,
	},
	content: {
		paddingBottom: 48,
		paddingTop: IS_IOS ? 0 : 8,
	},
	footer: {
		fontSize: IS_IOS ? 13 : 12,
		letterSpacing: IS_IOS ? 0 : 0.4,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 8,
	},
	host: {
		marginHorizontal: 12,
		marginTop: 4,
	},
	subtitle: {
		fontSize: IS_IOS ? 15 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: 20,
		marginHorizontal: 20,
		marginTop: 6,
	},
	wideButton: {
		width: "100%",
	},
})
