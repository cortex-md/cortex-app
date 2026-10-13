import type { DatabaseRow } from "@cortex/properties/database"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import {
	OptionPill,
	PersonLabel,
	RowDue,
	rowOwnerName,
	rowStatusOption,
} from "@/features/database/DatabaseCells"
import type { DatabaseViewModel } from "@/features/database/useDatabaseView"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function DatabaseGalleryView({
	highlighted,
	model,
	onOpenRow,
}: {
	highlighted: ReadonlySet<string>
	model: DatabaseViewModel
	onOpenRow: (row: DatabaseRow) => void
}) {
	const { colors } = useMobileColors()
	const rows = model.result?.rows ?? []

	return (
		<View style={styles.grid}>
			{rows.map((row) => {
				const option = rowStatusOption(row, model)
				const owner = rowOwnerName(row, model)
				return (
					<Pressable
						accessibilityRole="button"
						android_ripple={{ color: colors.hover }}
						key={row.path}
						onPress={() => onOpenRow(row)}
						style={({ pressed }) => [
							styles.card,
							{
								backgroundColor: highlighted.has(row.path) ? colors.accentSubtle : colors.cell,
								borderColor: colors.borderSubtle,
								opacity: pressed ? 0.75 : 1,
							},
						]}
					>
						<View style={[styles.cover, { backgroundColor: colors.secondaryBackground }]}>
							<Text numberOfLines={5} style={[styles.coverText, { color: colors.secondaryLabel }]}>
								{row.excerpt || row.preview}
							</Text>
						</View>
						<View style={styles.body}>
							<Text numberOfLines={2} style={[styles.title, { color: colors.label }]}>
								{row.title}
							</Text>
							<View style={styles.meta}>
								{option ? <OptionPill option={option} /> : null}
								{owner ? <PersonLabel name={owner} showName={false} size={18} /> : null}
								<RowDue model={model} row={row} small />
							</View>
						</View>
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	body: {
		gap: 8,
		padding: 12,
	},
	card: {
		borderCurve: "continuous",
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
		width: "48%",
	},
	cover: {
		height: 112,
		padding: 12,
	},
	coverText: {
		fontSize: 12,
		lineHeight: 16,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	meta: {
		alignItems: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
	},
	title: {
		fontSize: IS_IOS ? 16 : 15,
		fontWeight: "600",
		lineHeight: 21,
	},
})
