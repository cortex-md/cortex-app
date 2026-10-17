import { StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

export type StatusTone = "default" | "progress" | "done" | "review" | "backlog" | "error"

export function statusToneFromLabel(label: string): StatusTone {
	const value = label.toLowerCase()
	if (value.includes("progress") || value.includes("doing") || value === "live") return "progress"
	if (value.includes("done") || value.includes("complete")) return "done"
	if (value.includes("review") || value.includes("blocked")) return "review"
	if (value.includes("backlog") || value.includes("not started")) return "backlog"
	return "default"
}

function toneColors(tone: StatusTone, colors: MobileColors) {
	switch (tone) {
		case "progress":
			return { background: colors.accentSubtle, text: colors.tint }
		case "done":
			return { background: colors.successBackground, text: colors.successText }
		case "review":
			return { background: colors.warningBackground, text: colors.warningText }
		case "error":
			return { background: colors.errorBackground, text: colors.destructiveText }
		default:
			return { background: colors.fill, text: colors.secondaryLabel }
	}
}

export function StatusPill({
	compact = false,
	label,
	tone,
}: {
	compact?: boolean
	label: string
	tone?: StatusTone
}) {
	const { colors } = useMobileColors()
	const palette = toneColors(tone ?? statusToneFromLabel(label), colors)

	if (compact) {
		return (
			<View
				accessibilityLabel={label}
				style={[styles.compactDot, { backgroundColor: palette.text }]}
			/>
		)
	}

	return (
		<View style={[styles.pill, { backgroundColor: palette.background }]}>
			<View style={[styles.dot, { backgroundColor: palette.text }]} />
			<Text numberOfLines={1} style={[styles.label, { color: palette.text }]}>
				{label}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	compactDot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	dot: {
		borderRadius: 999,
		height: 7,
		width: 7,
	},
	label: {
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
	},
	pill: {
		alignItems: "center",
		alignSelf: "flex-start",
		borderRadius: 999,
		flexDirection: "row",
		gap: 6,
		height: 24,
		paddingHorizontal: 9,
	},
})
