import { Radio } from "lucide-react-native"
import { Platform, StyleSheet, Text, View } from "react-native"

import { statusToneColor, useNoteStatus } from "@/features/note/noteStatus"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function NoteTitleView({
	editing,
	live,
	liveCount,
	title,
}: {
	editing: boolean
	live: boolean
	liveCount: number
	title: string
}) {
	const { colors } = useMobileColors()
	const status = useNoteStatus(editing)
	const Icon = live ? Radio : status.Icon
	const label = live ? `Live · ${liveCount} editors` : status.label
	const color = live ? colors.successText : statusToneColor(status.tone, colors)

	return (
		<View accessibilityRole="header" style={IS_IOS ? styles.centered : styles.leading}>
			<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
				{title}
			</Text>
			<View style={styles.subtitle}>
				<Icon color={color} size={12} strokeWidth={2.4} />
				<Text numberOfLines={1} style={[styles.subtitleLabel, { color }]}>
					{label}
				</Text>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	centered: {
		alignItems: "center",
		maxWidth: 220,
	},
	leading: {
		alignItems: "flex-start",
		maxWidth: 240,
	},
	subtitle: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	subtitleLabel: {
		fontSize: 12,
		fontWeight: "500",
		lineHeight: 16,
	},
	title: {
		fontSize: IS_IOS ? 17 : 22,
		fontWeight: IS_IOS ? "600" : "400",
		lineHeight: IS_IOS ? 22 : 28,
	},
})
