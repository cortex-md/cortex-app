import { consumePendingOnboardingNote, getErrorMessage, useVaultStore } from "@cortex/core"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { Platform, RefreshControl, SectionList, StyleSheet, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { toast } from "@/features/feedback/useToast"
import { promptNewFolder } from "@/features/file-explorer/entryActions"
import { CreateFabMenu } from "@/features/files/CreateFabMenu"
import { FilesItemRow } from "@/features/files/FilesItemRow"
import { buildCreateMenuGroups, buildFilesMoreMenuGroups } from "@/features/files/filesMenus"
import { SyncChip } from "@/features/files/SyncChip"
import { useFilesScreenModel } from "@/features/files/useFilesScreenModel"
import { openNote, presentSheet } from "@/features/navigation/routes"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function uniqueNoteName(siblingNames: ReadonlySet<string>): string {
	if (!siblingNames.has("untitled.md")) return "Untitled"
	let index = 2
	while (siblingNames.has(`untitled ${index}.md`)) index++
	return `Untitled ${index}`
}

async function createNoteIn(parentPath: string, siblingNames: ReadonlySet<string>): Promise<void> {
	triggerSelectionHaptic()
	try {
		openNote(await useVaultStore.getState().createFile(parentPath, uniqueNoteName(siblingNames)))
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

async function refreshVaultFiles(setRefreshing: (value: boolean) => void): Promise<void> {
	setRefreshing(true)
	try {
		await useVaultStore.getState().refreshFiles()
	} finally {
		setRefreshing(false)
	}
}

function toolbarMenuGroups(groups: MenuGroup[]) {
	return groups.map((group) => (
		<Stack.Toolbar.Menu inline key={group[0]?.key ?? "group"}>
			{group.map((item) => (
				<Stack.Toolbar.MenuAction
					destructive={item.destructive}
					disabled={item.disabled}
					icon={item.icon?.sf}
					isOn={item.checked}
					key={item.key}
					onPress={item.onPress}
					subtitle={item.subtitle}
				>
					{item.label}
				</Stack.Toolbar.MenuAction>
			))}
		</Stack.Toolbar.Menu>
	))
}

function FilesHeaderIos({
	createGroups,
	isRoot,
	moreGroups,
}: {
	createGroups: MenuGroup[]
	isRoot: boolean
	moreGroups: MenuGroup[]
}) {
	const { openSidebar } = useMobileSidebar()
	return (
		<>
			{isRoot ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button icon="sidebar.leading" onPress={openSidebar} />
				</Stack.Toolbar>
			) : null}
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					icon="doc.text.magnifyingglass"
					onPress={() => presentSheet("quick-finder")}
				/>
				<Stack.Toolbar.Menu icon="plus" title="Create">
					{toolbarMenuGroups(createGroups)}
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu icon="ellipsis" title="More">
					{toolbarMenuGroups(moreGroups)}
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
		</>
	)
}

function AndroidHeaderRight({ moreGroups }: { moreGroups: MenuGroup[] }) {
	return (
		<View style={styles.androidActions}>
			<HeaderIconButton
				accessibilityLabel="Quick finder"
				icon={{ sf: "doc.text.magnifyingglass", md: "search" }}
				onPress={() => presentSheet("quick-finder")}
			/>
			<NativeMenu
				accessibilityLabel="More"
				groups={moreGroups}
				icon={{ sf: "ellipsis", md: "more_vert" }}
			/>
		</View>
	)
}

function toggleInSet(current: ReadonlySet<string>, value: string): ReadonlySet<string> {
	const next = new Set(current)
	if (next.has(value)) next.delete(value)
	else next.add(value)
	return next
}

export function FilesScreen() {
	const params = useLocalSearchParams<{ path?: string | string[] }>()
	const folderPath = Array.isArray(params.path) ? (params.path[0] ?? null) : (params.path ?? null)
	const { colors } = useMobileColors()
	const model = useFilesScreenModel(folderPath)
	const pendingOnboardingNotePath = useVaultStore((state) => state.pendingOnboardingNotePath)
	const [expandedDatabases, setExpandedDatabases] = useState<ReadonlySet<string>>(() => new Set())
	const [refreshing, setRefreshing] = useState(false)

	useEffect(() => {
		if (pendingOnboardingNotePath && !folderPath) consumePendingOnboardingNote(openNote)
	}, [folderPath, pendingOnboardingNotePath])

	const createGroups = buildCreateMenuGroups({
		onNewFolder: () => promptNewFolder(model.currentPath),
		onNewNote: () => void createNoteIn(model.currentPath, model.siblingNames),
	})
	const moreGroups = buildFilesMoreMenuGroups(model.sortOrder, model.isRoot)

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<Stack.Screen
				options={{
					title: model.title,
					headerLeft:
						!IS_IOS && model.isRoot
							? () => <SidebarToggleButton color={colors.label} />
							: undefined,
					headerRight: IS_IOS ? undefined : () => <AndroidHeaderRight moreGroups={moreGroups} />,
				}}
			/>
			{IS_IOS ? (
				<FilesHeaderIos createGroups={createGroups} isRoot={model.isRoot} moreGroups={moreGroups} />
			) : null}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(item) =>
					item.kind === "database" ? item.entry.folderPath : item.entry.path
				}
				ListEmptyComponent={
					<EmptyState
						icon={
							model.isRoot
								? { sf: "doc.text", md: "description" }
								: { sf: "folder", md: "folder_open" }
						}
						title={model.isRoot ? "No notes yet" : "This folder is empty"}
					/>
				}
				ListHeaderComponent={model.isRoot ? <SyncChip /> : null}
				ListHeaderComponentStyle={model.isRoot ? styles.listHeader : undefined}
				refreshControl={
					<RefreshControl
						onRefresh={() => void refreshVaultFiles(setRefreshing)}
						refreshing={refreshing}
						tintColor={colors.tint}
					/>
				}
				renderItem={({ index, item, section }) => (
					<FilesItemRow
						expanded={item.kind === "database" && expandedDatabases.has(item.entry.folderPath)}
						first={index === 0}
						item={item}
						last={index === section.data.length - 1}
						onToggleDatabase={(path) =>
							setExpandedDatabases((current) => toggleInSet(current, path))
						}
					/>
				)}
				renderSectionHeader={({ section }) => (
					<GroupedSectionHeader>{section.title}</GroupedSectionHeader>
				)}
				sections={model.sections}
				stickySectionHeadersEnabled={false}
			/>
			{IS_IOS ? null : <CreateFabMenu groups={createGroups} />}
		</View>
	)
}

const styles = StyleSheet.create({
	androidActions: {
		alignItems: "center",
		flexDirection: "row",
	},
	content: {
		paddingBottom: IS_IOS ? 32 : 160,
	},
	listHeader: {
		paddingTop: 4,
	},
	root: {
		flex: 1,
	},
})
