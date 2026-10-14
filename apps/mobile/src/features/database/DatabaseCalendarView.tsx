import { bucketRowsByDate, type DatabaseRow } from "@cortex/properties/database"
import { addMonths } from "@cortex/tasks"
import { useMemo, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { SymbolIcon } from "@/components/ui/Symbol"
import { GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { formatMonthTitle, MiniCalendar } from "@/components/ui/MiniCalendar"
import { OptionPill, rowOwnerName, rowStatusOption } from "@/features/database/DatabaseCells"
import { DatabaseRowMenu } from "@/features/database/DatabaseRowMenu"
import { firstName, formatDayHeading } from "@/features/database/databaseFormat"
import type { DatabaseViewModel } from "@/features/database/useDatabaseView"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function CalendarRow({
	model,
	onOpenRow,
	row,
	showOwner,
}: {
	model: DatabaseViewModel
	onOpenRow: (row: DatabaseRow) => void
	row: DatabaseRow
	showOwner: boolean
}) {
	const option = rowStatusOption(row, model)
	const owner = showOwner ? rowOwnerName(row, model) : null
	return (
		<DatabaseRowMenu onOpenRow={onOpenRow} row={row}>
			{(handlers) => (
				<GroupedRow
					onLongPress={handlers.onLongPress}
					onPress={handlers.onPress}
					subtitle={owner ? firstName(owner) : undefined}
					title={row.title}
					trailing={option ? <OptionPill option={option} /> : undefined}
				/>
			)}
		</DatabaseRowMenu>
	)
}

export function DatabaseCalendarView({
	model,
	onOpenRow,
}: {
	model: DatabaseViewModel
	onOpenRow: (row: DatabaseRow) => void
}) {
	const { colors } = useMobileColors()
	const today = model.queryContext.today
	const [month, setMonth] = useState(today)
	const [selected, setSelected] = useState(today)
	const dateKey = model.activeView?.date ?? model.roles.dateKey
	const rows = model.result?.rows
	const buckets = useMemo(() => bucketRowsByDate(rows ?? [], dateKey), [dateKey, rows])
	const marks = useMemo(
		() =>
			Object.fromEntries(
				[...buckets.byDate.entries()].map(([date, items]) => [date, items.length]),
			),
		[buckets],
	)
	const dayRows = buckets.byDate.get(selected) ?? []
	const title = formatMonthTitle(month)

	function changeMonth(delta: number) {
		triggerSelectionHaptic()
		setMonth(addMonths(month, delta, 1))
	}

	return (
		<View>
			<View style={styles.header}>
				<Text style={[styles.title, { color: colors.label }]}>{title}</Text>
				<View style={styles.nav}>
					<Pressable
						accessibilityRole="button"
						hitSlop={6}
						onPress={() => {
							setMonth(today)
							setSelected(today)
						}}
						style={({ pressed }) => [styles.todayButton, { opacity: pressed ? 0.5 : 1 }]}
					>
						<Text style={[styles.todayLabel, { color: colors.tint }]}>Today</Text>
					</Pressable>
					<Pressable
						accessibilityLabel="Previous month"
						hitSlop={6}
						onPress={() => changeMonth(-1)}
						style={styles.navButton}
					>
						<SymbolIcon
							color={colors.tint}
							name={{ md: "chevron_left", sf: "chevron.left" }}
							size={20}
						/>
					</Pressable>
					<Pressable
						accessibilityLabel="Next month"
						hitSlop={6}
						onPress={() => changeMonth(1)}
						style={styles.navButton}
					>
						<SymbolIcon
							color={colors.tint}
							name={{ md: "chevron_right", sf: "chevron.right" }}
							size={20}
						/>
					</Pressable>
				</View>
			</View>
			<View style={styles.grid}>
				<MiniCalendar
					accessibilityLabel={title}
					marks={marks}
					month={month}
					onSelectDate={(date) => {
						triggerSelectionHaptic()
						setSelected(date)
					}}
					rows={6}
					selected={selected}
					showHeader={false}
					today={today}
					weekStart="monday"
				/>
			</View>
			<GroupedSectionHeader>{formatDayHeading(selected)}</GroupedSectionHeader>
			<GroupedList>
				{dayRows.length > 0 ? (
					dayRows.map((row) => (
						<CalendarRow key={row.path} model={model} onOpenRow={onOpenRow} row={row} showOwner />
					))
				) : (
					<GroupedRow title="Nothing due this day" />
				)}
			</GroupedList>
			{buckets.undated.length > 0 ? (
				<>
					<GroupedSectionHeader>{`No due date · ${buckets.undated.length}`}</GroupedSectionHeader>
					<GroupedList>
						{buckets.undated.map((row) => (
							<CalendarRow
								key={row.path}
								model={model}
								onOpenRow={onOpenRow}
								row={row}
								showOwner={false}
							/>
						))}
					</GroupedList>
				</>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	grid: {
		paddingHorizontal: 12,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingLeft: 20,
		paddingRight: 12,
		paddingVertical: 4,
	},
	nav: {
		alignItems: "center",
		flexDirection: "row",
		gap: 2,
	},
	navButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 40,
	},
	title: {
		fontSize: IS_IOS ? 20 : 22,
		fontWeight: IS_IOS ? "600" : "400",
		lineHeight: 28,
	},
	todayButton: {
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	todayLabel: {
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		lineHeight: 22,
	},
})
