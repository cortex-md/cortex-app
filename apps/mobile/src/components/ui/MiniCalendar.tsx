import { addMonths, parseIsoDate, toIsoDate } from "@cortex/tasks"
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { useMemo } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const WEEK_LABELS = {
	monday: ["M", "T", "W", "T", "F", "S", "S"],
	sunday: ["S", "M", "T", "W", "T", "F", "S"],
} as const

export type MiniCalendarWeekStart = keyof typeof WEEK_LABELS

export interface MiniCalendarCell {
	date: string
	day: number
	inMonth: boolean
	isToday: boolean
	selected: boolean
	marks: number
}

function firstOfMonth(date: string): Date {
	const value = parseIsoDate(date)
	value.setDate(1)
	return value
}

export function formatMonthTitle(date: string): string {
	return parseIsoDate(date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function buildMiniCalendarCells({
	marks,
	month,
	rows = "auto",
	selected,
	today,
	weekStart,
}: {
	marks?: Record<string, number>
	month: string
	rows?: 5 | 6 | "auto"
	selected?: string
	today: string
	weekStart: MiniCalendarWeekStart
}): MiniCalendarCell[] {
	const first = firstOfMonth(month)
	const startIndex = weekStart === "monday" ? 1 : 0
	const offset = (first.getDay() - startIndex + 7) % 7
	const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
	const count = rows === "auto" ? (offset + daysInMonth > 35 ? 42 : 35) : rows * 7
	const cells: MiniCalendarCell[] = []
	for (let index = 0; index < count; index++) {
		const value = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index)
		const date = toIsoDate(value)
		cells.push({
			date,
			day: value.getDate(),
			inMonth: value.getMonth() === first.getMonth(),
			isToday: date === today,
			selected: date === selected,
			marks: marks?.[date] ?? 0,
		})
	}
	return cells
}

export function MiniCalendar({
	accessibilityLabel,
	marks,
	month,
	onChangeMonth,
	onSelectDate,
	rows = "auto",
	selected,
	showHeader = true,
	today,
	weekStart = "monday",
}: {
	accessibilityLabel?: string
	marks?: Record<string, number>
	month: string
	onChangeMonth?: (month: string) => void
	onSelectDate: (date: string) => void
	rows?: 5 | 6 | "auto"
	selected?: string
	showHeader?: boolean
	today: string
	weekStart?: MiniCalendarWeekStart
}) {
	const { colors } = useMobileColors()
	const cells = useMemo(
		() => buildMiniCalendarCells({ marks, month, rows, selected, today, weekStart }),
		[marks, month, rows, selected, today, weekStart],
	)
	const title = formatMonthTitle(month)

	return (
		<View accessibilityLabel={accessibilityLabel ?? title} style={styles.root}>
			{showHeader ? (
				<View style={styles.header}>
					<Text style={[styles.title, { color: colors.label }]}>{title}</Text>
					{onChangeMonth ? (
						<View style={styles.nav}>
							<Pressable
								accessibilityLabel="Previous month"
								hitSlop={8}
								onPress={() => onChangeMonth(addMonths(month, -1, 1))}
								style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
							>
								<ChevronLeft color={colors.tint} size={20} strokeWidth={2.4} />
							</Pressable>
							<Pressable
								accessibilityLabel="Next month"
								hitSlop={8}
								onPress={() => onChangeMonth(addMonths(month, 1, 1))}
								style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
							>
								<ChevronRight color={colors.tint} size={20} strokeWidth={2.4} />
							</Pressable>
						</View>
					) : null}
				</View>
			) : null}
			<View style={styles.weekRow}>
				{WEEK_LABELS[weekStart].map((label, index) => (
					<Text key={`${label}-${index}`} style={[styles.weekLabel, { color: colors.tertiaryLabel }]}>
						{label}
					</Text>
				))}
			</View>
			<View style={styles.grid}>
				{cells.map((cell) => {
					const labelColor = cell.selected
						? colors.onTint
						: cell.isToday
							? colors.tint
							: cell.inMonth
								? colors.label
								: colors.tertiaryLabel
					return (
						<Pressable
							accessibilityLabel={parseIsoDate(cell.date).toLocaleDateString("en-US", {
								weekday: "short",
								month: "short",
								day: "numeric",
							})}
							accessibilityRole="button"
							accessibilityState={{ selected: cell.selected }}
							key={cell.date}
							onPress={() => onSelectDate(cell.date)}
							style={styles.cell}
						>
							<View
								style={[
									styles.dayPill,
									cell.selected ? { backgroundColor: colors.tintFill } : null,
									cell.isToday && !cell.selected
										? { borderColor: colors.tint, borderWidth: StyleSheet.hairlineWidth * 2 }
										: null,
								]}
							>
								<Text
									style={[
										styles.dayLabel,
										{ color: labelColor, fontWeight: cell.isToday || cell.selected ? "600" : "400" },
									]}
								>
									{cell.day}
								</Text>
							</View>
							{cell.marks > 0 ? (
								<View style={styles.marks}>
									{Array.from({ length: Math.min(cell.marks, 3) }, (_, index) => (
										<View
											key={index}
											style={[
												styles.mark,
												{ backgroundColor: cell.selected ? colors.onTint : colors.tint },
											]}
										/>
									))}
								</View>
							) : null}
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	cell: {
		alignItems: "center",
		height: 46,
		justifyContent: "center",
		width: `${100 / 7}%`,
	},
	dayLabel: {
		fontSize: 15,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
	},
	dayPill: {
		alignItems: "center",
		borderRadius: IS_IOS ? 999 : 8,
		height: 30,
		justifyContent: "center",
		minWidth: 30,
		paddingHorizontal: 4,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	mark: {
		borderRadius: 999,
		height: 5,
		width: 5,
	},
	marks: {
		flexDirection: "row",
		gap: 2,
		height: 5,
		marginTop: 2,
	},
	nav: {
		flexDirection: "row",
		gap: 4,
	},
	navButton: {
		alignItems: "center",
		height: 32,
		justifyContent: "center",
		width: 32,
	},
	root: {
		paddingHorizontal: 4,
		paddingVertical: 4,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		lineHeight: 22,
	},
	weekLabel: {
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
		textAlign: "center",
		width: `${100 / 7}%`,
	},
	weekRow: {
		flexDirection: "row",
		paddingBottom: 4,
	},
})
