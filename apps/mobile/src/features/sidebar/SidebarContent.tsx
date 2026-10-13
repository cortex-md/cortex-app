import {
	createFileTreeViewModel,
	resolveVaultColor,
	useDatabaseStore,
	useEditorStore,
	useVaultStore,
} from "@cortex/core"
import { useMarketplaceStore } from "@cortex/marketplace"
import { router } from "expo-router"
import {
	CalendarCheck,
	ChevronsUpDown,
	FilePlus,
	FolderPlus,
	type LucideIcon,
	Settings,
	SquarePen,
	Store,
	Table2,
} from "lucide-react-native"
import { useMemo, useReducer } from "react"
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Badge } from "@/components/ui/Badge"
import { EntryActionsSheet } from "@/features/file-explorer/EntryActionsSheet"
import { MoveEntrySheet } from "@/features/file-explorer/MoveEntrySheet"
import { TextActionSheet } from "@/features/file-explorer/TextActionSheet"
import { useFileExplorerActions } from "@/features/file-explorer/useFileExplorerActions"
import { openDatabase, openSettings, presentSheet } from "@/features/navigation/routes"
import { useTodayBadge } from "@/features/navigation/useTodayBadge"
import { PluginSidebarSection } from "@/features/sidebar/PluginSidebarSection"
import { SidebarTreeRow } from "@/features/sidebar/SidebarTreeRow"
import { initialSidebarUiState, sidebarUiReducer } from "@/features/sidebar/sidebarUiState"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const ROW_HEIGHT = Platform.OS === "ios" ? 44 : 48

function SidebarRow({
	Icon,
	badge,
	colors,
	label,
	onPress,
	trailing,
}: {
	Icon: LucideIcon
	badge?: string
	colors: MobileColors
	label: string
	onPress: () => void
	trailing?: string
}) {
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: pressed ? colors.hover : "transparent" },
			]}
		>
			<Icon color={colors.label} size={20} strokeWidth={2} />
			<Text numberOfLines={1} style={[styles.rowLabel, { color: colors.label }]}>
				{label}
			</Text>
			{badge ? <Badge destructive label={badge} /> : null}
			{trailing ? (
				<Text style={[styles.rowTrailing, { color: colors.tertiaryLabel }]}>{trailing}</Text>
			) : null}
		</Pressable>
	)
}

function SectionHeader({
	colors,
	label,
	actions,
}: {
	colors: MobileColors
	label: string
	actions?: { Icon: LucideIcon; label: string; onPress: () => void }[]
}) {
	return (
		<View style={styles.sectionHeader}>
			<Text style={[styles.sectionLabel, { color: colors.secondaryLabel }]}>{label}</Text>
			{actions ? (
				<View style={styles.sectionActions}>
					{actions.map((action) => (
						<Pressable
							accessibilityLabel={action.label}
							hitSlop={6}
							key={action.label}
							onPress={action.onPress}
							style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}
						>
							<action.Icon color={colors.label} size={20} strokeWidth={2} />
						</Pressable>
					))}
				</View>
			) : null}
		</View>
	)
}

export function SidebarContent({ closeSidebar }: { closeSidebar: () => void }) {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const vault = useVaultStore((state) => state.vault)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const files = useVaultStore((state) => state.files)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const databases = useDatabaseStore((state) => state.databases)
	const rowsByFolder = useDatabaseStore((state) => state.rowsByFolder)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const todayBadge = useTodayBadge()
	const [uiState, dispatchUi] = useReducer(sidebarUiReducer, initialSidebarUiState)
	const sidebarUi = { closeSidebar, dispatchUi, uiState }
	const explorer = useFileExplorerActions(sidebarUi)
	const databaseEntries = useMemo(() => Object.values(databases), [databases])
	const databaseFolderPaths = useMemo(
		() => new Set(databaseEntries.map((entry) => entry.folderPath)),
		[databaseEntries],
	)
	const treeView = useMemo(
		() =>
			createFileTreeViewModel(files, vault?.path ?? null, uiState.expandedFolders, {
				databaseFolderPaths,
			}),
		[files, vault?.path, uiState.expandedFolders, databaseFolderPaths],
	)
	const updateCount = Object.keys(availableUpdates).length
	const registryEntry = recentVaults.find((entry) => entry.uuid === vault?.uuid)
	const vaultColor = vault
		? resolveVaultColor({ color: registryEntry?.color ?? null, uuid: vault.uuid })
		: colors.tintFill

	function openVaultSwitcher() {
		triggerSelectionHaptic()
		presentSheet("vault-switcher")
	}

	function goToToday() {
		closeSidebar()
		router.navigate("/(tabs)/(today)" as never)
	}

	return (
		<View style={[styles.root, { paddingTop: insets.top + 8 }]}>
			<View style={styles.vaultRow}>
				<Pressable
					accessibilityLabel={`Switch vault, current vault ${vault?.name ?? "Cortex"}`}
					onPress={openVaultSwitcher}
					style={({ pressed }) => [
						styles.vaultPill,
						{ backgroundColor: pressed ? colors.fill2 : colors.fill },
					]}
				>
					<View style={[styles.vaultDot, { backgroundColor: vaultColor }]} />
					<Text numberOfLines={1} style={[styles.vaultName, { color: colors.label }]}>
						{vault?.name ?? "Cortex"}
					</Text>
					<ChevronsUpDown color={colors.tertiaryLabel} size={16} strokeWidth={2.4} />
				</Pressable>
				{Platform.OS === "ios" ? (
					<Pressable
						accessibilityLabel="New note"
						onPress={explorer.openCreateNoteSheet}
						style={({ pressed }) => [
							styles.newNoteButton,
							{ backgroundColor: pressed ? colors.fill2 : colors.fill },
						]}
					>
						<SquarePen color={colors.label} size={20} strokeWidth={2} />
					</Pressable>
				) : null}
			</View>

			<FlatList
				ListFooterComponent={
					<View style={[styles.footer, { borderTopColor: colors.separator }]}>
						<PluginSidebarSection closeSidebar={closeSidebar} />
						<SidebarRow
							Icon={Store}
							badge={undefined}
							colors={colors}
							label="Marketplace"
							onPress={() => {
								closeSidebar()
								openSettings("marketplace")
							}}
							trailing={updateCount > 0 ? `${updateCount} update${updateCount === 1 ? "" : "s"}` : undefined}
						/>
						<SidebarRow
							Icon={Settings}
							colors={colors}
							label="Settings"
							onPress={() => {
								closeSidebar()
								openSettings()
							}}
						/>
					</View>
				}
				ListHeaderComponent={
					<View>
						<SidebarRow
							Icon={CalendarCheck}
							badge={todayBadge}
							colors={colors}
							label="Today"
							onPress={goToToday}
						/>
						{databaseEntries.length > 0 ? (
							<SectionHeader colors={colors} label="Databases" />
						) : null}
						{databaseEntries.map((entry) => (
							<SidebarRow
								Icon={Table2}
								colors={colors}
								key={entry.folderPath}
								label={entry.name}
								onPress={() => {
									closeSidebar()
									openDatabase(entry.folderPath)
								}}
								trailing={String(Object.keys(rowsByFolder[entry.folderPath]?.rows ?? {}).length || "")}
							/>
						))}
						<SectionHeader
							actions={[
								{ Icon: FilePlus, label: "New note", onPress: explorer.openCreateNoteSheet },
								{ Icon: FolderPlus, label: "New folder", onPress: explorer.openCreateFolderSheet },
							]}
							colors={colors}
							label="Files"
						/>
					</View>
				}
				contentContainerStyle={styles.listContent}
				data={treeView.rows}
				getItemLayout={(_, index) => ({ index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index })}
				keyExtractor={(item) => item.node.path}
				onRefresh={explorer.handleRefresh}
				refreshing={false}
				renderItem={({ item }) => (
					<SidebarTreeRow
						active={activeFilePath === item.node.path}
						depth={item.depth}
						entry={item.node}
						expanded={uiState.expandedFolders.has(item.node.path)}
						onLongPress={explorer.handleOpenEntryActions}
						onOpenNote={explorer.handleOpenNote}
						onToggleFolder={explorer.handleToggleFolder}
						title={item.title}
					/>
				)}
				style={styles.list}
			/>

			<EntryActionsSheet
				entry={uiState.entryActionsEntry}
				onAction={explorer.handleEntryAction}
				onDismiss={() => {
					if (!uiState.submitting) dispatchUi({ entry: null, type: "set-entry-actions-entry" })
				}}
				onPluginAction={explorer.handlePluginEntryAction}
				submitting={uiState.submitting}
			/>
			<MoveEntrySheet
				destinations={explorer.moveDestinations}
				entry={uiState.moveEntry}
				error={uiState.moveError}
				onDismiss={() => {
					if (!uiState.submitting) dispatchUi({ entry: null, type: "set-move-entry" })
				}}
				onMove={(targetParentPath) => {
					void explorer.handleMoveEntry(targetParentPath)
				}}
				submitting={uiState.submitting}
				textColor={colors.label}
			/>
			<TextActionSheet
				key={`${uiState.textAction?.kind ?? "none"}:${explorer.textInitialValue}`}
				action={uiState.textAction}
				error={uiState.textError}
				initialValue={explorer.textInitialValue}
				onDismiss={() => {
					if (!uiState.submitting) dispatchUi({ action: null, type: "set-text-action" })
				}}
				onSubmit={(value) => {
					void explorer.handleSubmitTextAction(value)
				}}
				submitting={uiState.submitting}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	footer: {
		borderTopWidth: StyleSheet.hairlineWidth,
		marginTop: 8,
		paddingTop: 8,
	},
	iconButton: {
		alignItems: "center",
		height: 36,
		justifyContent: "center",
		width: 36,
	},
	list: {
		flex: 1,
	},
	listContent: {
		paddingBottom: 24,
	},
	newNoteButton: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 999,
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	root: {
		flex: 1,
		paddingBottom: 24,
		paddingHorizontal: 12,
	},
	row: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 999,
		flexDirection: "row",
		gap: 12,
		minHeight: ROW_HEIGHT,
		paddingHorizontal: 12,
	},
	rowLabel: {
		flex: 1,
		fontSize: Platform.OS === "ios" ? 17 : 14,
		fontWeight: Platform.OS === "ios" ? "400" : "500",
		letterSpacing: Platform.OS === "ios" ? 0 : 0.1,
		lineHeight: Platform.OS === "ios" ? 22 : 20,
	},
	rowTrailing: {
		fontSize: 15,
		lineHeight: 20,
	},
	sectionActions: {
		flexDirection: "row",
	},
	sectionHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 10,
		paddingLeft: 12,
		paddingRight: 4,
	},
	sectionLabel: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	vaultDot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	vaultName: {
		flex: 1,
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	vaultPill: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 999,
		flex: 1,
		flexDirection: "row",
		gap: 10,
		height: 48,
		paddingHorizontal: 16,
	},
	vaultRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		paddingBottom: 12,
	},
})
