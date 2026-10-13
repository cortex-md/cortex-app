import { addTaskFromQuickAdd } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	createTaskLine,
	describeRepeat,
	formatRelativeDay,
	parseQuickAdd,
	resolveReminderPreset,
	type TaskFields,
} from "@cortex/tasks"
import { ArrowUp, Calendar, Check, Clock, Inbox, type LucideIcon, Repeat } from "lucide-react-native"
import { useMemo, useState } from "react"
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"

import { TaskLineCode } from "@/features/today/TaskLineCode"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const HINT = "Try “Pay rent every month on the 5th”, “Call Ana tomorrow at 3pm”"
const INBOX_FILE = "Inbox.md"

function ParsedChip({ Icon, label, muted = false }: { Icon: LucideIcon; label: string; muted?: boolean }) {
	const { colors } = useMobileColors()
	const color = muted ? colors.secondaryLabel : colors.tint
	return (
		<View
			style={[
				styles.chip,
				{ backgroundColor: muted ? colors.fill : colors.accentSubtle },
			]}
		>
			<Icon color={color} size={14} strokeWidth={2.2} />
			<Text style={[styles.chipLabel, { color }]}>{label}</Text>
		</View>
	)
}

export function QuickAddOverlay({
	onClose,
	today,
	visible,
}: {
	onClose: () => void
	today: string
	visible: boolean
}) {
	const { colors } = useMobileColors()
	const taskSettings = useSettingsStore((state) => state.settings.tasks)
	const [draft, setDraft] = useState("")
	const [added, setAdded] = useState<string | null>(null)
	const trimmed = draft.trim()

	const parsed = useMemo(() => parseQuickAdd(trimmed, today), [trimmed, today])
	const line = useMemo(() => {
		if (!trimmed) return ""
		const fields: TaskFields = {
			status: "open",
			title: parsed.title || "New task",
			due: parsed.due,
			time: parsed.time,
			repeat: parsed.repeat,
			reminder:
				parsed.due && parsed.time
					? resolveReminderPreset(
							taskSettings.defaultReminder,
							parsed.due,
							parsed.time,
							taskSettings.untimedReminderTime,
						)
					: undefined,
		}
		return createTaskLine(fields)
	}, [parsed, taskSettings, trimmed])

	const hasTokens = Boolean(parsed.due || parsed.time || parsed.repeat)

	const submit = () => {
		if (!trimmed) return
		void addTaskFromQuickAdd(parsed).then((ok) => {
			if (!ok) return
			setAdded(parsed.title)
			setDraft("")
		})
	}

	return (
		<Modal
			animationType="fade"
			onRequestClose={onClose}
			statusBarTranslucent
			transparent
			visible={visible}
		>
			<Pressable
				accessibilityLabel="Cancel"
				onPress={onClose}
				style={[styles.scrim, { backgroundColor: colors.scrim }]}
			>
				<KeyboardAvoidingView
					behavior={IS_IOS ? "padding" : undefined}
					pointerEvents="box-none"
					style={styles.keyboard}
				>
					<Pressable
						accessibilityLabel="New task"
						accessibilityRole="none"
						onPress={(event) => event.stopPropagation()}
						style={[
							styles.card,
							IS_IOS
								? {
										backgroundColor: colors.elevated,
										borderColor: colors.glassEdge,
										boxShadow: `0 8px 40px ${colors.shadow}`,
									}
								: { backgroundColor: colors.fill },
						]}
					>
						{added ? (
							<View accessibilityRole="text" style={styles.success}>
								<Check color={colors.successText} size={14} strokeWidth={2.6} />
								<Text style={[styles.successText, { color: colors.successText }]}>
									“{added}” added to Inbox
								</Text>
							</View>
						) : null}
						<View style={styles.inputRow}>
							<View style={[styles.checkbox, { borderColor: colors.borderStrong }]} />
							<TextInput
								accessibilityLabel="Task"
								autoFocus
								blurOnSubmit={false}
								onChangeText={(value) => {
									setDraft(value)
									if (added) setAdded(null)
								}}
								onSubmitEditing={submit}
								placeholder="Add a task"
								placeholderTextColor={colors.placeholder}
								returnKeyType="done"
								style={[styles.input, { color: colors.label }]}
								value={draft}
							/>
							<Pressable
								accessibilityLabel="Add task"
								accessibilityRole="button"
								disabled={!trimmed}
								onPress={submit}
								style={({ pressed }) => [
									styles.sendButton,
									{ backgroundColor: colors.tintFill, opacity: !trimmed ? 0.4 : pressed ? 0.8 : 1 },
								]}
							>
								<ArrowUp color={colors.onTint} size={20} strokeWidth={2.4} />
							</Pressable>
						</View>
						{trimmed ? (
							<>
								<View style={styles.chips}>
									{parsed.due ? (
										<ParsedChip Icon={Calendar} label={formatRelativeDay(parsed.due, today)} />
									) : null}
									{parsed.time ? <ParsedChip Icon={Clock} label={parsed.time} /> : null}
									{parsed.repeat ? (
										<ParsedChip Icon={Repeat} label={describeRepeat(parsed.repeat)} />
									) : null}
									{!hasTokens ? <ParsedChip Icon={Inbox} label="Inbox" muted /> : null}
								</View>
								<View style={styles.preview}>
									<TaskLineCode line={line} />
									<Text style={[styles.destination, { color: colors.secondaryLabel }]}>
										Goes to {INBOX_FILE}
									</Text>
								</View>
							</>
						) : (
							<Text style={[styles.hint, { color: colors.secondaryLabel }]}>{HINT}</Text>
						)}
					</Pressable>
				</KeyboardAvoidingView>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	card: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 32 : 0,
		borderTopLeftRadius: IS_IOS ? 32 : 28,
		borderTopRightRadius: IS_IOS ? 32 : 28,
		borderWidth: IS_IOS ? StyleSheet.hairlineWidth : 0,
		marginBottom: IS_IOS ? 8 : 0,
		marginHorizontal: IS_IOS ? 8 : 0,
		paddingBottom: 12,
		paddingLeft: 16,
		paddingRight: IS_IOS ? 14 : 12,
		paddingTop: IS_IOS ? 14 : 16,
	},
	checkbox: {
		borderRadius: 999,
		borderWidth: 2,
		height: 22,
		width: 22,
	},
	chip: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: 6,
		height: 30,
		paddingHorizontal: 12,
	},
	chipLabel: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
	chips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginLeft: 36,
		marginTop: 10,
	},
	destination: {
		fontSize: 12,
		lineHeight: 16,
		marginTop: 6,
	},
	hint: {
		fontSize: 12,
		lineHeight: 16,
		marginLeft: 36,
		marginTop: 10,
	},
	input: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
		minWidth: 0,
		paddingVertical: 8,
	},
	inputRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
	},
	keyboard: {
		flex: 1,
		justifyContent: "flex-end",
	},
	preview: {
		marginLeft: 36,
		marginTop: 10,
	},
	scrim: {
		flex: 1,
	},
	sendButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 38,
		justifyContent: "center",
		width: 38,
	},
	success: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		marginBottom: 8,
	},
	successText: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
})
