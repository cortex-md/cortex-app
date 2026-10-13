import { StyleSheet, Text, View } from "react-native"

import type { ImpactCell } from "@/components/ui/dialogTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function ImpactGrid({ cells }: { cells: ImpactCell[] }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.grid}>
			{cells.map((cell) => (
				<View key={cell.label} style={[styles.cell, { backgroundColor: colors.fill }]}>
					<Text style={[styles.label, { color: colors.secondaryLabel }]}>{cell.label}</Text>
					<Text style={[styles.value, { color: colors.label }]}>{cell.value}</Text>
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	cell: {
		borderCurve: "continuous",
		borderRadius: 12,
		flex: 1,
		gap: 2,
		padding: 10,
	},
	grid: {
		flexDirection: "row",
		gap: 6,
	},
	label: {
		fontSize: 11,
		fontWeight: "600",
		lineHeight: 14,
		textTransform: "uppercase",
	},
	value: {
		fontSize: 13,
		lineHeight: 18,
	},
})
