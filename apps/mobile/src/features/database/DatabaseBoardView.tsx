import { Plus } from "lucide-react-native"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { PersonLabel, RowDue, rowOwnerName } from "@/features/database/DatabaseCells"
import {
	type DatabaseCollectionProps,
	GroupLabel,
	visibleGroups,
} from "@/features/database/DatabaseTableView"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const COLUMN_WIDTH = 280

export function DatabaseBoardView({
	highlighted,
	model,
	onCreate,
	onOpenRow,
}: Omit<DatabaseCollectionProps, "collapsed" | "onToggleGroup">) {
	const { colors } = useMobileColors()
	const groups = visibleGroups(model)
	const grouped = Boolean(model.activeView?.group && model.resolved.byKey.has(model.activeView.group))

	return (
		<ScrollView
			accessibilityLabel="Board"
			contentContainerStyle={styles.board}
			horizontal
			showsHorizontalScrollIndicator={false}
		>
			{groups.map((group) => (
				<View
					accessibilityLabel={group.label || "All notes"}
					key={group.key}
					style={[styles.column, { backgroundColor: colors.secondaryBackground }]}
				>
					<View style={styles.columnHeader}>
						<GroupLabel group={group} model={model} />
						<Text style={[styles.count, { color: colors.secondaryLabel }]}>{group.rows.length}</Text>
					</View>
					{group.rows.map((row) => {
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
										opacity: pressed ? 0.7 : 1,
									},
								]}
							>
								<Text numberOfLines={3} style={[styles.cardTitle, { color: colors.label }]}>
									{row.title}
								</Text>
								<View style={styles.meta}>
									{owner ? <PersonLabel name={owner} showName={false} size={18} /> : null}
									<RowDue model={model} row={row} small />
								</View>
							</Pressable>
						)
					})}
					<Pressable
						accessibilityLabel={`New note${group.label ? ` in ${group.label}` : ""}`}
						accessibilityRole="button"
						onPress={() => onCreate(grouped ? group : null)}
						style={({ pressed }) => [styles.add, { opacity: pressed ? 0.5 : 1 }]}
					>
						<Plus color={colors.secondaryLabel} size={18} strokeWidth={2.2} />
						<Text style={[styles.addLabel, { color: colors.secondaryLabel }]}>New</Text>
					</Pressable>
				</View>
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	add: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		height: 44,
		paddingHorizontal: 6,
	},
	addLabel: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	board: {
		alignItems: "flex-start",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	card: {
		borderCurve: "continuous",
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 10,
		overflow: "hidden",
		padding: 14,
	},
	cardTitle: {
		fontSize: IS_IOS ? 16 : 15,
		fontWeight: "500",
		lineHeight: 21,
	},
	column: {
		borderCurve: "continuous",
		borderRadius: 22,
		gap: 8,
		padding: 10,
		width: COLUMN_WIDTH,
	},
	columnHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 4,
		paddingVertical: 6,
	},
	count: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
	},
	meta: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
})
