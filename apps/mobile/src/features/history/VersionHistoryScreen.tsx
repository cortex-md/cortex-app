import { Stack, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Platform, SectionList, StyleSheet, Text } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { InsetListRow, InsetSectionHeader } from "@/features/history/InsetListRow"
import { readParam, useVersionHistory } from "@/features/history/useVersionHistory"
import {
	type DeviceFilter,
	filterVersions,
	formatVersionTime,
	groupVersionsByDay,
	type VersionEntry,
} from "@/features/history/versionHistoryAdapter"
import { openVersion } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

const FILTER_OPTIONS: { label: string; value: DeviceFilter }[] = [
	{ label: "All devices", value: "all" },
	{ label: "This device", value: "device" },
	{ label: "Other devices", value: "others" },
]

function versionSummary(version: VersionEntry): string {
	if (version.isCurrent) return version.who
	return `${version.who} · +${version.added} −${version.removed} words`
}

export function VersionHistoryScreen() {
	useHideTabBar()
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { history } = useVersionHistory(filePath)
	const [filter, setFilter] = useState<DeviceFilter>("all")

	const versions = history ? filterVersions(history.versions, filter) : []
	const sections = groupVersionsByDay(versions).map((group) => ({
		data: group.versions,
		title: group.label,
	}))

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					title: "Version history",
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="Show versions from"
									groups={[
										FILTER_OPTIONS.map((option) => ({
											checked: filter === option.value,
											key: option.value,
											label: option.label,
											onPress: () => setFilter(option.value),
										})),
									]}
									icon={{ sf: "line.3.horizontal.decrease", md: "filter_list" }}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu
						accessibilityLabel="Show versions from"
						icon={
							filter === "all"
								? "line.3.horizontal.decrease.circle"
								: "line.3.horizontal.decrease.circle.fill"
						}
					>
						{FILTER_OPTIONS.map((option) => (
							<Stack.Toolbar.MenuAction
								isOn={filter === option.value}
								key={option.value}
								onPress={() => setFilter(option.value)}
							>
								{option.label}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : null}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(version) => version.id}
				ListEmptyComponent={
					history ? (
						<EmptyState
							icon={{ sf: "clock.arrow.circlepath", md: "history" }}
							title="No versions from these devices"
						/>
					) : (
						<ActivityIndicator color={colors.tint} style={styles.loading} />
					)
				}
				renderItem={({ index, item, section }) => (
					<InsetListRow
						chevron
						first={index === 0}
						last={index === section.data.length - 1}
						leading={<Avatar name={item.who} size={26} tint={item.isMine ? "accent" : "blue"} />}
						onPress={() => openVersion(filePath ?? "", item.id)}
						subtitle={versionSummary(item)}
						title={item.title}
						trailing={
							<Text style={[styles.time, { color: colors.secondaryLabel }]}>
								{formatVersionTime(item.timestamp)}
							</Text>
						}
					/>
				)}
				renderSectionHeader={({ section }) => <InsetSectionHeader title={section.title} />}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
	loading: {
		marginTop: 32,
	},
	time: {
		fontSize: 15,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
	},
})
