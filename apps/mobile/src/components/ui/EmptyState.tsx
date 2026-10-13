import type { LucideIcon } from "lucide-react-native"
import { StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function EmptyState({
	Icon,
	description,
	title,
}: {
	Icon?: LucideIcon
	description?: string
	title: string
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.root}>
			{Icon ? <Icon color={colors.tertiaryLabel} size={34} strokeWidth={1.8} /> : null}
			<Text style={[styles.title, { color: colors.label }]}>{title}</Text>
			{description ? (
				<Text style={[styles.description, { color: colors.secondaryLabel }]}>{description}</Text>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	description: {
		fontSize: 15,
		lineHeight: 20,
		textAlign: "center",
	},
	root: {
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 32,
		paddingVertical: 40,
	},
	title: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
})
