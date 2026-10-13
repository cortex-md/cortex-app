import { findTaskById, getTaskSource, reportAppError, useTasksStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	applyTaskPatch,
	isSameRepeat,
	resolveReminderPreset,
	type Task,
	type TaskPatch,
	type TaskRepeat,
	type TaskStatus,
	toIsoDate,
} from "@cortex/tasks"
import { useLocalSearchParams } from "expo-router"
import {
	Bell,
	Check,
	ChevronLeft,
	ExternalLink,
	FileText,
	type LucideIcon,
	Repeat,
	X,
} from "lucide-react-native"
import { type ReactNode, useMemo, useState } from "react"
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedFooter, GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { formatMonthTitle, MiniCalendar } from "@/components/ui/MiniCalendar"
import { RadioDialog } from "@/components/ui/RadioDialog"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { dismissSheet, openNote, openSettings } from "@/features/navigation/routes"
import { TaskLineCode } from "@/features/today/TaskLineCode"
import { TaskCheckbox } from "@/features/today/TaskRow"
import {
	describeRemindChoice,
	describeRepeatChoice,
	REPEAT_FOOTER,
	type RemindChoice,
	remindChoiceOf,
	remindChoices,
	type RepeatChoice,
	repeatChoiceOf,
	repeatChoices,
	repeatOfChoice,
	TASKS_FOOTER,
	type TimeChoice,
	timeChoices,
} from "@/features/today/taskOptions"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const REMIND_FOOTER_IOS = "Reminders are read from ⏰ on the line and delivered by iOS, even when Cortex is closed. "
const REMIND_FOOTER_ANDROID =
	"Delivered by Android from the ⏰ on the line, even when Cortex is closed."

type Pane = "detail" | "repeat" | "remind"

interface TaskDraft {
	due?: string
	remind: RemindChoice | "custom"
	repeat?: TaskRepeat
	status: TaskStatus
	time?: string
	title: string
}

function draftFromTask(task: Task, untimedReminderTime: string): TaskDraft {
	return {
		due: task.due,
		remind: remindChoiceOf(task, untimedReminderTime),
		repeat: task.repeat,
		status: task.status,
		time: task.time,
		title: task.title,
	}
}

function buildPatch(
	task: Task,
	draft: TaskDraft,
	untimedReminderTime: string,
	today: string,
): TaskPatch {
	const patch: TaskPatch = {}
	const title = draft.title.trim()
	if (title && title !== task.title) patch.title = title
	if (draft.status !== task.status) {
		patch.status = draft.status
		patch.doneDate = draft.status === "done" ? today : null
	}
	if ((draft.due ?? null) !== (task.due ?? null)) patch.due = draft.due ?? null
	if ((draft.time ?? null) !== (task.time ?? null)) patch.time = draft.time ?? null
	if (!isSameRepeat(draft.repeat, task.repeat)) patch.repeat = draft.repeat ?? null
	if (draft.remind === "custom") return patch
	if (draft.remind === "none" || !draft.due) {
		if (task.reminder) patch.reminder = null
		return patch
	}
	const reminder = resolveReminderPreset(draft.remind, draft.due, draft.time, untimedReminderTime)
	if (
		task.reminder?.time !== reminder.time ||
		(task.reminder?.date ?? undefined) !== reminder.date ||
		patch.due !== undefined ||
		patch.time !== undefined
	) {
		patch.reminder = reminder
	}
	return patch
}

async function saveTask(task: Task, patch: TaskPatch): Promise<void> {
	if (Object.keys(patch).length === 0) return
	try {
		await useTasksStore.getState().updateTask(task, patch)
	} catch (cause) {
		await reportAppError({
			operation: "update-task",
			source: "tasks",
			cause,
			userMessage: "Cortex could not update this task. The note may have changed or be read-only.",
		})
	}
}

function openTaskNote(task: Task): void {
	dismissSheet()
	openNote(task.path)
}

function openNotificationSettings(): void {
	dismissSheet()
	openSettings("notifications")
}

function SectionLabel({ children, trailing }: { children: string; trailing?: ReactNode }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.sectionHeader}>
			<Text style={[styles.sectionTitle, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
				{children}
			</Text>
			{trailing}
		</View>
	)
}

function PaneHeader({ onBack, title }: { onBack: () => void; title: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.paneHeader}>
			<Pressable
				accessibilityLabel="Back"
				onPress={onBack}
				style={({ pressed }) => [
					styles.paneButton,
					{ backgroundColor: pressed ? colors.fill2 : colors.fill },
				]}
			>
				<ChevronLeft color={colors.label} size={22} strokeWidth={2.2} />
			</Pressable>
			<Text style={[styles.paneTitle, { color: colors.label }]}>{title}</Text>
			<View style={styles.paneButton} />
		</View>
	)
}

function RadioList<T extends string>({
	onSelect,
	options,
	value,
}: {
	onSelect: (value: T) => void
	options: { label: string; value: T }[]
	value: T | "custom"
}) {
	const { colors } = useMobileColors()
	return (
		<GroupedList>
			{options.map((option) => (
				<GroupedRow
					accessibilityLabel={option.label}
					key={option.value}
					onPress={() => onSelect(option.value)}
					title={option.label}
					trailing={
						option.value === value ? <Check color={colors.tint} size={20} strokeWidth={2.4} /> : null
					}
				/>
			))}
		</GroupedList>
	)
}

function AndroidTopBar({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	return (
		<View style={[styles.topBar, { paddingTop: insets.top }]}>
			<Pressable
				accessibilityLabel="Close"
				android_ripple={{ borderless: true, color: colors.hover }}
				onPress={onClose}
				style={styles.topBarButton}
			>
				<X color={colors.label} size={24} strokeWidth={2} />
			</Pressable>
			<Text style={[styles.topBarTitle, { color: colors.label }]}>Task</Text>
			<Pressable
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				onPress={onSave}
				style={styles.saveButton}
			>
				<Text style={[styles.saveLabel, { color: colors.tint }]}>Save</Text>
			</Pressable>
		</View>
	)
}

function SettingRowIcon({ Icon }: { Icon: LucideIcon }) {
	const { colors } = useMobileColors()
	return <Icon color={colors.secondaryLabel} size={IS_IOS ? 20 : 24} strokeWidth={2} />
}

function TaskDetailForm({ task }: { task: Task }) {
	const { colors } = useMobileColors()
	const inboxPath = useTasksStore((state) => state.inboxPath)
	const untimedReminderTime = useSettingsStore(
		(state) => state.settings.tasks.untimedReminderTime,
	)
	const today = toIsoDate(new Date())
	const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task, untimedReminderTime))
	const [month, setMonth] = useState(() => `${(task.due ?? today).slice(0, 7)}-01`)
	const [pane, setPane] = useState<Pane>("detail")
	const [dialog, setDialog] = useState<Exclude<Pane, "detail"> | null>(null)

	const patch = useMemo(
		() => buildPatch(task, draft, untimedReminderTime, today),
		[draft, task, today, untimedReminderTime],
	)
	const line = useMemo(() => applyTaskPatch(task.raw, patch), [patch, task.raw])
	const source = `${getTaskSource(task, inboxPath)}.md`
	const repeatChoice = repeatChoiceOf(draft.repeat)
	const repeatLabel = describeRepeatChoice(draft.repeat)
	const remindLabel = describeRemindChoice(draft.remind, task, untimedReminderTime)
	const timeChoice: TimeChoice = (draft.time as TimeChoice | undefined) ?? "none"

	const update = (next: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...next }))

	const handleSave = () => {
		void saveTask(task, patch).then(dismissSheet)
	}

	const selectRepeat = (choice: RepeatChoice) => {
		update({ repeat: repeatOfChoice(choice), due: draft.due ?? today })
	}

	const selectRemind = (choice: RemindChoice) => {
		update({ remind: choice })
	}

	const clearDate = () => {
		update({ due: undefined, repeat: undefined, time: undefined })
	}

	const detailBody = (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			keyboardDismissMode="on-drag"
			keyboardShouldPersistTaps="handled"
		>
			<View style={IS_IOS ? [styles.titleCard, { backgroundColor: colors.cell }] : styles.titleCardM3}>
				<View style={styles.titleRow}>
					<TaskCheckbox
						done={draft.status === "done"}
						onToggle={() => update({ status: draft.status === "done" ? "open" : "done" })}
						title={draft.title}
					/>
					<TextInput
						accessibilityLabel="Task"
						onChangeText={(title) => update({ title })}
						placeholder="Task"
						placeholderTextColor={colors.placeholder}
						style={[styles.titleInput, { color: colors.label }]}
						value={draft.title}
					/>
				</View>
				{IS_IOS ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}
				{IS_IOS ? (
					<GroupedRow
						chevron
						leading={<SettingRowIcon Icon={FileText} />}
						onPress={() => openTaskNote(task)}
						title={`In ${source}`}
					/>
				) : null}
			</View>
			{!IS_IOS ? (
				<GroupedList>
					<GroupedRow
						leading={<SettingRowIcon Icon={FileText} />}
						onPress={() => openTaskNote(task)}
						title={`In ${source}`}
						trailing={<ExternalLink color={colors.secondaryLabel} size={24} strokeWidth={2} />}
					/>
				</GroupedList>
			) : null}

			<SectionLabel
				trailing={
					<Pressable accessibilityRole="button" hitSlop={8} onPress={clearDate}>
						<Text style={[styles.sectionAction, { color: colors.tint }]}>No date</Text>
					</Pressable>
				}
			>
				{`Date · ${formatMonthTitle(month)}`}
			</SectionLabel>
			<View style={[styles.calendarCard, { backgroundColor: colors.cell }]}>
				<MiniCalendar
					month={month}
					onChangeMonth={setMonth}
					onSelectDate={(date) => update({ due: date })}
					rows={5}
					selected={draft.due}
					showHeader={false}
					today={today}
				/>
			</View>

			<SectionLabel>Time</SectionLabel>
			<View style={styles.segmented}>
				<SegmentedControl
					accessibilityLabel="Time"
					onChange={(choice) =>
						update({
							time: choice === "none" ? undefined : choice,
							due: choice === "none" ? draft.due : (draft.due ?? today),
						})
					}
					options={timeChoices}
					value={timeChoice}
				/>
			</View>

			<View style={styles.rows}>
				<GroupedList>
					<GroupedRow
						chevron
						leading={<SettingRowIcon Icon={Repeat} />}
						onPress={() => (IS_IOS ? setPane("repeat") : setDialog("repeat"))}
						title="Repeat"
						value={repeatLabel}
					/>
					<GroupedRow
						chevron
						leading={<SettingRowIcon Icon={Bell} />}
						onPress={() => (IS_IOS ? setPane("remind") : setDialog("remind"))}
						title="Remind me"
						value={remindLabel}
					/>
				</GroupedList>
			</View>

			<SectionLabel>In the file</SectionLabel>
			<View style={styles.code}>
				<TaskLineCode line={line} />
			</View>
			<GroupedFooter>{TASKS_FOOTER}</GroupedFooter>
		</ScrollView>
	)

	if (IS_IOS && pane === "repeat") {
		return (
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				<PaneHeader onBack={() => setPane("detail")} title="Repeat" />
				<ScrollView contentContainerStyle={styles.content}>
					<RadioList
						onSelect={selectRepeat}
						options={repeatChoices}
						value={repeatChoice}
					/>
					<GroupedFooter>{REPEAT_FOOTER}</GroupedFooter>
					<View style={styles.code}>
						<TaskLineCode line={line} />
					</View>
				</ScrollView>
			</View>
		)
	}

	if (IS_IOS && pane === "remind") {
		return (
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				<PaneHeader onBack={() => setPane("detail")} title="Remind me" />
				<ScrollView contentContainerStyle={styles.content}>
					<RadioList onSelect={selectRemind} options={remindChoices} value={draft.remind} />
					<GroupedFooter>
						{REMIND_FOOTER_IOS}
						<Text onPress={openNotificationSettings} style={{ color: colors.tint }}>
							Notification settings
						</Text>
					</GroupedFooter>
					<View style={styles.code}>
						<TaskLineCode line={line} />
					</View>
				</ScrollView>
			</View>
		)
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			{IS_IOS ? (
				<SheetHeader onClose={dismissSheet} onDone={handleSave} title="Task" />
			) : (
				<AndroidTopBar onClose={dismissSheet} onSave={handleSave} />
			)}
			{detailBody}
			{!IS_IOS ? (
				<>
					<RadioDialog
						onDone={() => setDialog(null)}
						onSelect={selectRepeat}
						options={repeatChoices}
						title="Repeat"
						value={repeatChoice === "custom" ? "none" : repeatChoice}
						visible={dialog === "repeat"}
					/>
					<RadioDialog
						actions={[{ label: "Settings", onPress: openNotificationSettings }]}
						message={REMIND_FOOTER_ANDROID}
						onDone={() => setDialog(null)}
						onSelect={selectRemind}
						options={remindChoices}
						title="Remind me"
						value={draft.remind === "custom" ? "none" : draft.remind}
						visible={dialog === "remind"}
					/>
				</>
			) : null}
		</View>
	)
}

export function TaskDetailSheet() {
	const { colors } = useMobileColors()
	const { taskId } = useLocalSearchParams<{ taskId?: string }>()
	const task = useTasksStore((state) => (taskId ? findTaskById(state, taskId) : undefined))

	if (!task) {
		return (
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				{IS_IOS ? (
					<SheetHeader onClose={dismissSheet} title="Task" />
				) : (
					<AndroidTopBar onClose={dismissSheet} onSave={dismissSheet} />
				)}
				<EmptyState
					description="The line was removed from its note or the note is no longer indexed."
					title="Task not found"
				/>
			</View>
		)
	}

	return <TaskDetailForm key={task.id} task={task} />
}

const styles = StyleSheet.create({
	calendarCard: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		paddingVertical: 6,
	},
	code: {
		paddingHorizontal: 16,
	},
	content: {
		paddingBottom: 40,
	},
	paneButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	paneHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		minHeight: 60,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	paneTitle: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	root: {
		flex: 1,
	},
	rows: {
		marginTop: 16,
	},
	saveButton: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	saveLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	sectionAction: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: "500",
		lineHeight: IS_IOS ? 18 : 20,
	},
	sectionHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 20,
	},
	sectionTitle: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 18 : 20,
	},
	segmented: {
		paddingHorizontal: 16,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 16,
	},
	titleCard: {
		borderCurve: "continuous",
		borderRadius: 26,
		marginHorizontal: 16,
		overflow: "hidden",
	},
	titleCardM3: {
		marginBottom: 12,
	},
	titleInput: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 22,
		fontWeight: IS_IOS ? "600" : "400",
		lineHeight: IS_IOS ? 22 : 28,
		minWidth: 0,
		paddingVertical: 0,
	},
	titleRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 52,
		paddingHorizontal: IS_IOS ? 16 : 24,
		paddingVertical: IS_IOS ? 10 : 8,
	},
	topBar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		minHeight: 64,
		paddingHorizontal: 4,
	},
	topBarButton: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	topBarTitle: {
		flex: 1,
		fontSize: 22,
		lineHeight: 28,
		marginLeft: 4,
	},
})
