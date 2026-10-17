import type { Task } from "@cortex/tasks"
import { Stack } from "expo-router"
import { useState } from "react"
import { Platform, SectionList, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EmptyState } from "@/components/ui/EmptyState"
import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { openSettings, openTask } from "@/features/navigation/routes"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { openQuickAdd } from "@/features/today/quickAddActions"
import { TaskRow, taskRowPosition } from "@/features/today/TaskRow"
import {
	completeTask,
	type TaskSection,
	type TodayTabKey,
	todayEmptyTitles,
	useTodayTasks,
} from "@/features/today/useTodayTasks"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function openNotificationSettings(): void {
	openSettings("notifications")
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

function TodayHeaderIos() {
	const { openSidebar } = useMobileSidebar()
	return (
		<>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					accessibilityLabel="Open sidebar"
					icon="sidebar.leading"
					onPress={openSidebar}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					accessibilityLabel="Notification settings"
					icon="bell"
					onPress={openNotificationSettings}
				/>
				<Stack.Toolbar.Button accessibilityLabel="New task" icon="plus" onPress={openQuickAdd} />
			</Stack.Toolbar>
		</>
	)
}

function TodayHeaderAndroid() {
	const { openSidebar } = useMobileSidebar()
	return (
		<Stack.Screen
			options={{
				headerLeft: () => (
					<HeaderIconButton
						accessibilityLabel="Open sidebar"
						icon={{ sf: "sidebar.leading", md: "menu" }}
						onPress={openSidebar}
					/>
				),
				headerRight: () => (
					<HeaderIconButton
						accessibilityLabel="Notification settings"
						icon={{ sf: "bell", md: "notifications" }}
						onPress={openNotificationSettings}
					/>
				),
			}}
		/>
	)
}

export function TodayScreen() {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const [tab, setTab] = useState<TodayTabKey>("today")
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
				contentContainerStyle={{ paddingBottom: insets.bottom + (IS_IOS ? 40 : 96) }}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(task) => task.id}
				ListEmptyComponent={
					<EmptyState
						icon={{ sf: "checkmark.circle", md: "task_alt" }}
						title={todayEmptyTitles[tab]}
					/>
				}
				ListHeaderComponent={
					<SegmentedControl
						accessibilityLabel="Task views"
						onChange={setTab}
						options={tabOptions}
						style={styles.segments}
						value={tab}
					/>
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
			<Stack.Screen options={{ title: "Today" }} />
			{IS_IOS ? <TodayHeaderIos /> : <TodayHeaderAndroid />}
			{IS_IOS ? null : (
				<View pointerEvents="box-none" style={[styles.fab, { bottom: insets.bottom + 16 }]}>
					<FloatingActionButton
						accessibilityLabel="New task"
						icon={{ sf: "plus", md: "add" }}
						label="New task"
						onPress={openQuickAdd}
					/>
				</View>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	fab: {
		position: "absolute",
		right: 16,
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
	segments: {
		marginHorizontal: 16,
		marginTop: IS_IOS ? 8 : 4,
	},
})
