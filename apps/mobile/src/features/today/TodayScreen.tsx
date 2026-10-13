import type { Task } from "@cortex/tasks"
import { Stack } from "expo-router"
import { Bell, Plus } from "lucide-react-native"
import { useState } from "react"
import { Platform, SectionList, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { GroupedFooter } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { openSettings, openTask } from "@/features/navigation/routes"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { QuickAddOverlay } from "@/features/today/QuickAddOverlay"
import { TaskRow, taskRowPosition } from "@/features/today/TaskRow"
import { TASKS_FOOTER } from "@/features/today/taskOptions"
import {
	completeTask,
	describeTodaySubhead,
	type TaskSection,
	type TodayTabKey,
	todayTabTitles,
	useTodayTasks,
} from "@/features/today/useTodayTasks"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const EMPTY_MESSAGE = "Nothing left for today."

function openNotificationSettings(): void {
	openSettings("notifications")
}

function renderSidebarToggle() {
	return <SidebarToggleButton />
}

function renderNotificationsButton() {
	return (
		<HeaderIconButton
			Icon={Bell}
			accessibilityLabel="Notification settings"
			onPress={openNotificationSettings}
		/>
	)
}

function TaskSectionHeader({ section }: { section: TaskSection }) {
	const { colors } = useMobileColors()
	const color = section.overdue
		? colors.destructiveText
		: IS_IOS
			? colors.secondaryLabel
			: colors.tint
	return (
		<View style={styles.sectionHeader}>
			<Text style={[styles.sectionTitle, { color }]}>{section.title}</Text>
			<Text style={[styles.sectionTitle, { color }]}>{section.data.length}</Text>
		</View>
	)
}

export function TodayScreen() {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const [tab, setTab] = useState<TodayTabKey>("today")
	const [quickAddVisible, setQuickAddVisible] = useState(false)
	const { counts, inboxPath, sections, today, untimedReminderTime } = useTodayTasks(tab)

	const tabOptions: { label: string; value: TodayTabKey }[] = [
		{ label: `Today ${counts.today}`, value: "today" },
		{ label: `Upcoming ${counts.upcoming}`, value: "upcoming" },
		{ label: `Inbox ${counts.inbox}`, value: "inbox" },
	]

	const handleToggle = (task: Task) => {
		void completeTask(task, inboxPath)
	}

	const handleOpen = (task: Task) => {
		openTask(task.id)
	}

	return (
		<>
			<SectionList
				contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(task) => task.id}
				keyboardShouldPersistTaps="handled"
				ListEmptyComponent={
					<Text style={[styles.empty, { color: colors.secondaryLabel }]}>{EMPTY_MESSAGE}</Text>
				}
				ListFooterComponent={<GroupedFooter>{TASKS_FOOTER}</GroupedFooter>}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.subhead, { color: colors.secondaryLabel }]}>
							{describeTodaySubhead(tab, today)}
						</Text>
						<SegmentedControl
							accessibilityLabel="Task views"
							onChange={setTab}
							options={tabOptions}
							value={tab}
						/>
					</View>
				}
				renderItem={({ index, item, section }) => (
					<TaskRow
						inboxPath={inboxPath}
						onPress={handleOpen}
						onToggle={handleToggle}
						position={taskRowPosition(index, section.data.length)}
						showDate={section.showDate}
						task={item}
						today={today}
						untimedReminderTime={untimedReminderTime}
					/>
				)}
				renderSectionHeader={({ section }) => <TaskSectionHeader section={section} />}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			<Stack.Screen
				options={{
					headerLeft: renderSidebarToggle,
					headerRight: IS_IOS ? undefined : renderNotificationsButton,
					title: todayTabTitles[tab],
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						accessibilityLabel="Notification settings"
						icon="ellipsis"
						onPress={openNotificationSettings}
					/>
				</Stack.Toolbar>
			) : null}
			<View
				pointerEvents="box-none"
				style={[styles.fab, { bottom: IS_IOS ? insets.bottom + 70 : 16 + insets.bottom }]}
			>
				<FloatingActionButton
					Icon={Plus}
					accessibilityLabel="New task"
					label="New task"
					onPress={() => setQuickAddVisible(true)}
					sf="plus"
				/>
			</View>
			<QuickAddOverlay
				onClose={() => setQuickAddVisible(false)}
				today={today}
				visible={quickAddVisible}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingTop: IS_IOS ? 0 : 4,
	},
	empty: {
		fontSize: 15,
		lineHeight: 20,
		marginTop: 60,
		textAlign: "center",
	},
	fab: {
		position: "absolute",
		right: IS_IOS ? 20 : 16,
	},
	header: {
		gap: 10,
		paddingBottom: 6,
		paddingHorizontal: 16,
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
	subhead: {
		fontSize: 15,
		lineHeight: 20,
		marginLeft: 4,
		marginTop: IS_IOS ? -6 : 0,
	},
})
