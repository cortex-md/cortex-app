import { Stack, useLocalSearchParams } from "expo-router"
import { ActivityIndicator, Platform, SectionList, StyleSheet, Text, View } from "react-native"
import { useState } from "react"

import { Avatar } from "@/components/ui/Avatar"
import { FilterChip } from "@/components/ui/FilterChip"
import { GroupedFooter, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
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
	{ label: "All", value: "all" },
	{ label: "This device", value: "device" },
	{ label: "Others", value: "others" },
]

function statLabel(version: VersionEntry): string {
	return `+${version.added} −${version.removed} words`
}

function VersionRow({
	first,
	last,
	onPress,
	version,
}: {
	first: boolean
	last: boolean
	onPress: () => void
	version: VersionEntry
}) {
	const { colors } = useMobileColors()
	const meta = `${version.who} · ${version.device}`
	return (
		<View
			style={[
				styles.cell,
				{ backgroundColor: colors.cell },
				first ? styles.cellFirst : null,
				last ? styles.cellLast : null,
				!IS_IOS && !last ? styles.m3Gap : null,
			]}
		>
			<GroupedRow
				chevron={IS_IOS}
				leading={<Avatar name={version.who} size={36} tint={version.isMine ? "accent" : "blue"} />}
				onPress={onPress}
				subtitle={IS_IOS ? meta : `${meta} · ${statLabel(version)}`}
				title={version.title}
				trailing={
					<View style={styles.trailing}>
						<Text style={[styles.time, { color: colors.secondaryLabel }]}>
							{formatVersionTime(version.timestamp)}
						</Text>
						{IS_IOS ? (
							<Text style={[styles.stat, { color: colors.tertiaryLabel }]}>{statLabel(version)}</Text>
						) : null}
					</View>
				}
			/>
			{IS_IOS && !last ? (
				<View style={[styles.separator, { backgroundColor: colors.separator }]} />
			) : null}
		</View>
	)
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
		label: group.label,
		data: group.versions,
	}))
	const subtitle = history
		? `${history.noteName} · ${history.versions.length} ${history.versions.length === 1 ? "version" : "versions"}`
		: ""

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					title: "Version history",
					...(IS_IOS
						? { headerTitle: "Version history" }
						: {
								headerTitle: () => (
									<View>
										<Text style={[styles.androidTitle, { color: colors.label }]}>Version history</Text>
										<Text style={[styles.androidSubtitle, { color: colors.secondaryLabel }]}>
											{subtitle}
										</Text>
									</View>
								),
							}),
				}}
			/>
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(version) => version.id}
				ListEmptyComponent={
					history ? null : <ActivityIndicator color={colors.tint} style={styles.loading} />
				}
				ListFooterComponent={
					history ? (
						<GroupedFooter>
							Kept by Cortex Sync. Restoring keeps the current text as a new version, so nothing is
							lost.
						</GroupedFooter>
					) : null
				}
				ListHeaderComponent={
					<View style={styles.header}>
						{IS_IOS ? (
							<>
								<Text style={[styles.iosSubtitle, { color: colors.secondaryLabel }]}>{subtitle}</Text>
								<SegmentedControl
									accessibilityLabel="Show versions from"
									onChange={setFilter}
									options={FILTER_OPTIONS}
									value={filter}
								/>
							</>
						) : (
							<View style={styles.chips}>
								{FILTER_OPTIONS.map((option) => (
									<FilterChip
										key={option.value}
										label={option.label}
										onPress={() => setFilter(option.value)}
										selected={filter === option.value}
									/>
								))}
							</View>
						)}
					</View>
				}
				renderItem={({ index, item, section }) => (
					<VersionRow
						first={index === 0}
						last={index === section.data.length - 1}
						onPress={() => openVersion(filePath ?? "", item.id)}
						version={item}
					/>
				)}
				renderSectionHeader={({ section }) => (
					<GroupedSectionHeader>{IS_IOS ? section.label.toUpperCase() : section.label}</GroupedSectionHeader>
				)}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	androidSubtitle: {
		fontSize: 12,
		letterSpacing: 0.4,
		lineHeight: 16,
	},
	androidTitle: {
		fontSize: 18,
		lineHeight: 24,
	},
	cell: {
		borderCurve: "continuous",
		marginHorizontal: 16,
		overflow: "hidden",
	},
	cellFirst: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	cellLast: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	chips: {
		flexDirection: "row",
		gap: 8,
	},
	content: {
		paddingBottom: 40,
	},
	header: {
		gap: 12,
		marginHorizontal: 16,
		marginTop: 8,
	},
	iosSubtitle: {
		fontSize: 15,
		lineHeight: 20,
		textAlign: "center",
	},
	loading: {
		marginTop: 32,
	},
	m3Gap: {
		marginBottom: 2,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 64,
	},
	stat: {
		fontSize: 12,
		fontVariant: ["tabular-nums"],
		lineHeight: 16,
	},
	time: {
		fontSize: 15,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
	},
	trailing: {
		alignItems: "flex-end",
	},
})
