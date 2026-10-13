import { getErrorMessage, useVaultStore } from "@cortex/core"
import { Stack, useLocalSearchParams } from "expo-router"
import { ChevronsUpDown, FileSearch, MoreVertical } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { toast } from "@/features/feedback/useToast"
import { CreateFabMenu } from "@/features/files/CreateFabMenu"
import { FilesDialogs, type FilesDialogState, NO_FILES_DIALOG } from "@/features/files/FilesDialogs"
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

function ToolbarMenuGroups({ groups }: { groups: MenuGroup[] }) {
	return (
		<>
			{groups.map((group) => (
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
			))}
		</>
	)
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
					<ToolbarMenuGroups groups={createGroups} />
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu icon="ellipsis" title="More">
					<ToolbarMenuGroups groups={moreGroups} />
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
		</>
	)
}

function AndroidHeaderRight({ moreGroups }: { moreGroups: MenuGroup[] }) {
	return (
		<View style={styles.androidActions}>
			<HeaderIconButton
				Icon={FileSearch}
				accessibilityLabel="Quick finder"
				onPress={() => presentSheet("quick-finder")}
			/>
			<NativeMenu
				accessibilityLabel="More"
				groups={moreGroups}
				icon={{ sf: "ellipsis", Lucide: MoreVertical }}
			/>
		</View>
	)
}

function FilesListHeader({ isRoot, vaultName }: { isRoot: boolean; vaultName: string }) {
	const { colors } = useMobileColors()
	if (!isRoot) return <View style={styles.headerSpacer} />
	return (
		<View style={styles.listHeader}>
			<SyncChip />
			{IS_IOS ? (
				<Pressable
					accessibilityLabel={`${vaultName}, switch vault`}
					accessibilityRole="button"
					hitSlop={8}
					onPress={() => {
						triggerSelectionHaptic()
						presentSheet("vault-switcher")
					}}
					style={({ pressed }) => [styles.switchVault, { opacity: pressed ? 0.5 : 1 }]}
				>
					<Text style={[styles.switchVaultLabel, { color: colors.secondaryLabel }]}>Switch vault</Text>
					<ChevronsUpDown color={colors.secondaryLabel} size={16} strokeWidth={2.4} />
				</Pressable>
			) : null}
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
	const [expandedDatabases, setExpandedDatabases] = useState<ReadonlySet<string>>(() => new Set())
	const [dialog, setDialog] = useState<FilesDialogState>(NO_FILES_DIALOG)
	const [refreshing, setRefreshing] = useState(false)
	const createGroups = buildCreateMenuGroups({
		onNewFolder: () => setDialog({ kind: "new-folder" }),
		onNewNote: () => void createNoteIn(model.currentPath, model.siblingNames),
	})
	const moreGroups = buildFilesMoreMenuGroups(model.sortOrder)

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<Stack.Screen
				options={{
					title: model.title,
					headerLeft:
						!IS_IOS && model.isRoot ? () => <SidebarToggleButton color={colors.label} /> : undefined,
					headerRight: IS_IOS ? undefined : () => <AndroidHeaderRight moreGroups={moreGroups} />,
				}}
			/>
			{IS_IOS ? (
				<FilesHeaderIos createGroups={createGroups} isRoot={model.isRoot} moreGroups={moreGroups} />
			) : null}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(item) => (item.kind === "database" ? item.entry.folderPath : item.entry.path)}
				ListEmptyComponent={
					<EmptyState
						description={
							model.isRoot ? "Create a note or a folder to get started." : "This folder has no notes yet."
						}
						title={model.isRoot ? "No notes yet" : "Empty folder"}
					/>
				}
				ListHeaderComponent={
					<FilesListHeader isRoot={model.isRoot} vaultName={model.vault?.name ?? "Vault"} />
				}
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
						onDialog={setDialog}
						onToggleDatabase={(path) => setExpandedDatabases((current) => toggleInSet(current, path))}
					/>
				)}
				renderSectionHeader={({ section }) => <GroupedSectionHeader>{section.title}</GroupedSectionHeader>}
				sections={model.sections}
				stickySectionHeadersEnabled={false}
			/>
			{IS_IOS ? null : <CreateFabMenu groups={createGroups} />}
			<FilesDialogs
				currentPath={model.currentPath}
				dialog={dialog}
				locationLabel={model.title}
				onChange={setDialog}
				siblingNames={model.siblingNames}
				vault={model.vault}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	androidActions: {
		alignItems: "center",
		flexDirection: "row",
	},
	content: {
		paddingBottom: 130,
	},
	headerSpacer: {
		height: 4,
	},
	listHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		justifyContent: "space-between",
		marginTop: IS_IOS ? -4 : 4,
		paddingRight: 16,
	},
	root: {
		flex: 1,
	},
	switchVault: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		height: 32,
	},
	switchVaultLabel: {
		fontSize: 15,
		lineHeight: 20,
	},
})
