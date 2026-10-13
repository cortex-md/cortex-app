import { describeTaskReminder, getTaskSource } from "@cortex/core"
import { describeRepeat, formatRelativeDay, type Task } from "@cortex/tasks"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const CHECKED: SymbolName = { sf: "checkmark.circle.fill", md: "check_circle" }
const UNCHECKED: SymbolName = { sf: "circle", md: "radio_button_unchecked" }
const CALENDAR: SymbolName = { sf: "calendar", md: "calendar_today" }
const REPEAT: SymbolName = { sf: "repeat", md: "repeat" }
const BELL: SymbolName = { sf: "bell", md: "notifications" }
const NOTE: SymbolName = { sf: "doc.text", md: "description" }

export type TaskRowPosition = "first" | "middle" | "last" | "only"

export function taskRowPosition(index: number, total: number): TaskRowPosition {
	if (total === 1) return "only"
	if (index === 0) return "first"
	if (index === total - 1) return "last"
	return "middle"
}

function TaskCheckbox({
	done,
	onToggle,
	title,
}: {
	done: boolean
	onToggle: () => void
	title: string
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityLabel={done ? `Mark not done: ${title}` : `Complete: ${title}`}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: done }}
			hitSlop={10}
			onPress={onToggle}
			style={styles.checkbox}
		>
			<SymbolIcon
				color={done ? colors.tint : colors.tertiaryLabel}
				name={done ? CHECKED : UNCHECKED}
				size={24}
			/>
		</Pressable>
	)
}

function MetaItem({
	icon,
	label,
	late = false,
}: {
	icon: SymbolName
	label: string
	late?: boolean
}) {
	const { colors } = useMobileColors()
	const color = late ? colors.destructiveText : colors.secondaryLabel
	return (
		<View style={styles.metaItem}>
			<SymbolIcon color={color} name={icon} size={13} />
			<Text numberOfLines={1} style={[styles.metaText, { color }]}>
				{label}
			</Text>
		</View>
	)
}

export function TaskRow({
	inboxPath,
	onPress,
	onToggle,
	position,
	showDate,
	task,
	today,
	untimedReminderTime,
}: {
	inboxPath: string | null
	onPress: (task: Task) => void
	onToggle: (task: Task) => void
	position: TaskRowPosition
	showDate: boolean
	task: Task
	today: string
	untimedReminderTime: string
}) {
	const { colors } = useMobileColors()
	const done = task.status === "done"
	const late = !done && task.due !== undefined && task.due < today
	const reminderLabel = describeTaskReminder(task, untimedReminderTime, today)
	const roundTop = position === "first" || position === "only"
	const roundBottom = position === "last" || position === "only"
	const radius = IS_IOS ? 26 : 20

	return (
		<View
			style={[
				styles.cell,
				{ backgroundColor: colors.cell },
				roundTop ? { borderTopLeftRadius: radius, borderTopRightRadius: radius } : null,
				roundBottom ? { borderBottomLeftRadius: radius, borderBottomRightRadius: radius } : null,
				!IS_IOS && !roundBottom ? styles.m3Gap : null,
			]}
		>
			<View style={styles.row}>
				<TaskCheckbox done={done} onToggle={() => onToggle(task)} title={task.title} />
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					onPress={() => onPress(task)}
					style={({ pressed }) => [styles.body, { opacity: pressed && IS_IOS ? 0.6 : 1 }]}
				>
					<Text
						numberOfLines={2}
						style={[
							styles.title,
							{ color: done ? colors.secondaryLabel : colors.label },
							done ? styles.titleDone : null,
						]}
					>
						{task.title}
					</Text>
					<View style={styles.meta}>
						{showDate && task.due ? (
							<MetaItem icon={CALENDAR} label={formatRelativeDay(task.due, today)} late={late} />
						) : null}
						{task.repeat ? <MetaItem icon={REPEAT} label={describeRepeat(task.repeat)} /> : null}
						{reminderLabel ? <MetaItem icon={BELL} label={reminderLabel} /> : null}
						<MetaItem icon={NOTE} label={getTaskSource(task, inboxPath)} />
					</View>
				</Pressable>
				{task.time ? (
					<Text style={[styles.time, { color: colors.secondaryLabel }]}>{task.time}</Text>
				) : null}
			</View>
			{IS_IOS && !roundBottom ? (
				<View style={[styles.separator, { backgroundColor: colors.separator }]} />
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	body: {
		flex: 1,
		gap: 4,
		minWidth: 0,
	},
	cell: {
		borderCurve: "continuous",
		marginHorizontal: 16,
		overflow: "hidden",
	},
	checkbox: {
		alignItems: "center",
		height: 24,
		justifyContent: "center",
		width: 24,
	},
	m3Gap: {
		marginBottom: 2,
	},
	meta: {
		columnGap: 10,
		flexDirection: "row",
		flexWrap: "wrap",
		rowGap: 2,
	},
	metaItem: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	metaText: {
		fontSize: 13,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: 18,
	},
	row: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 50,
	},
	time: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
		marginTop: 2,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
	},
	titleDone: {
		textDecorationLine: "line-through",
	},
})
