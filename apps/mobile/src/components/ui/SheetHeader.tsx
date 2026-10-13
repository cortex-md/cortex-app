import { Check, X } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function SheetHeader({
	onClose,
	onDone,
	subtitle,
	title,
}: {
	onClose?: () => void
	onDone?: () => void
	subtitle?: string
	title: string
}) {
	const { colors } = useMobileColors()

	if (!IS_IOS) {
		return (
			<View style={styles.m3Header}>
				<View style={styles.m3Titles}>
					<Text numberOfLines={1} style={[styles.m3Title, { color: colors.label }]}>
						{title}
					</Text>
					{subtitle ? (
						<Text numberOfLines={1} style={[styles.m3Subtitle, { color: colors.secondaryLabel }]}>
							{subtitle}
						</Text>
					) : null}
				</View>
				{onClose ? (
					<Pressable
						accessibilityLabel="Close"
						hitSlop={8}
						onPress={onClose}
						style={styles.m3Close}
					>
						<X color={colors.secondaryLabel} size={24} strokeWidth={2} />
					</Pressable>
				) : null}
			</View>
		)
	}

	return (
		<View style={styles.header}>
			<View style={styles.side}>
				{onClose ? (
					<Pressable
						accessibilityLabel="Close"
						onPress={onClose}
						style={({ pressed }) => [
							styles.glassButton,
							{ backgroundColor: pressed ? colors.fill2 : colors.fill },
						]}
					>
						<X color={colors.label} size={20} strokeWidth={2.2} />
					</Pressable>
				) : null}
			</View>
			<View style={styles.titles}>
				<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
					{title}
				</Text>
				{subtitle ? (
					<Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondaryLabel }]}>
						{subtitle}
					</Text>
				) : null}
			</View>
			<View style={[styles.side, styles.sideEnd]}>
				{onDone ? (
					<Pressable
						accessibilityLabel="Done"
						onPress={onDone}
						style={({ pressed }) => [
							styles.glassButton,
							{ backgroundColor: colors.tintFill, opacity: pressed ? 0.8 : 1 },
						]}
					>
						<Check color={colors.onTint} size={20} strokeWidth={2.6} />
					</Pressable>
				) : null}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	glassButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: 60,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	m3Close: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	m3Header: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		paddingBottom: 12,
		paddingLeft: 24,
		paddingRight: 12,
		paddingTop: 8,
	},
	m3Subtitle: {
		fontSize: 14,
		letterSpacing: 0.25,
		lineHeight: 20,
	},
	m3Title: {
		fontSize: 22,
		lineHeight: 28,
	},
	m3Titles: {
		flex: 1,
		minWidth: 0,
	},
	side: {
		flexDirection: "row",
		minWidth: 44,
	},
	sideEnd: {
		justifyContent: "flex-end",
	},
	subtitle: {
		fontSize: 12,
		lineHeight: 14,
		textAlign: "center",
	},
	title: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
	titles: {
		alignItems: "center",
		flex: 1,
		minWidth: 0,
	},
})
