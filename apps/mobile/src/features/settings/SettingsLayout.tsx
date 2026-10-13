import { FieldGroup, Host } from "@expo/ui"
import type { ReactNode } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function SettingsScroll({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			keyboardDismissMode="on-drag"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			{children}
		</ScrollView>
	)
}

export function SettingsIntro({ children }: { children: string }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.intro, { color: colors.secondaryLabel }]}>{children}</Text>
}

export function SettingsGroup({ children }: { children: ReactNode }) {
	return (
		<Host matchContents style={styles.host}>
			<FieldGroup>{children}</FieldGroup>
		</Host>
	)
}

export function SettingsSection({
	children,
	title,
}: {
	children: ReactNode
	title?: string
}) {
	return (
		<Host matchContents style={styles.host}>
			<FieldGroup>
				<FieldGroup.Section title={title}>{children}</FieldGroup.Section>
			</FieldGroup>
		</Host>
	)
}

export function SettingsFooter({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.footer, { color: colors.secondaryLabel }]}>{children}</Text>
}

export function SettingsBlock({ children }: { children: ReactNode }) {
	return <View style={styles.block}>{children}</View>
}

const styles = StyleSheet.create({
	block: {
		marginTop: 12,
	},
	content: {
		paddingBottom: 48,
		paddingHorizontal: IS_IOS ? 4 : 0,
		paddingTop: IS_IOS ? 0 : 8,
	},
	footer: {
		fontSize: IS_IOS ? 13 : 12,
		letterSpacing: IS_IOS ? 0 : 0.4,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: IS_IOS ? 32 : 32,
		marginTop: 6,
	},
	host: {
		marginTop: 4,
	},
	intro: {
		fontSize: IS_IOS ? 15 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: 20,
		marginHorizontal: IS_IOS ? 32 : 32,
		marginTop: 8,
	},
})
