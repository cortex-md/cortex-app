import {
	resolveVaultColor,
	useDatabaseStore,
	useEditorStore,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { useMarketplaceStore } from "@cortex/marketplace"
import { router } from "expo-router"
import { useMemo, useReducer } from "react"
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SymbolIcon } from "@/components/ui/Symbol"
import { useFileExplorerActions } from "@/features/file-explorer/useFileExplorerActions"
import { useVaultDisplayName } from "@/features/file-explorer/vaultDisplayName"
import { openDatabase, openSettings, presentSheet } from "@/features/navigation/routes"
import { useTodayBadge } from "@/features/navigation/useTodayBadge"
import { PluginSidebarRows } from "@/features/sidebar/PluginSidebarRows"
import { SidebarRow, SidebarSectionHeader } from "@/features/sidebar/SidebarRows"
import { SidebarTreeRow } from "@/features/sidebar/SidebarTreeRow"
import { initialSidebarUiState, sidebarUiReducer } from "@/features/sidebar/sidebarUiState"
import { useSyncConflictCount, useSyncStatusPresentation } from "@/features/sync/syncStatus"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function VaultSwitcherRow({ onPress }: { onPress: () => void }) {
	const { colors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const name = useVaultDisplayName()
	const registryEntry = recentVaults.find((entry) => entry.uuid === vault?.uuid)
	const vaultColor = vault
		? resolveVaultColor({ color: registryEntry?.color ?? null, uuid: vault.uuid })
		: colors.tintFill

	return (
		<Pressable
			accessibilityHint="Opens the vault switcher"
			accessibilityLabel={`${name}, switch vault`}
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={() => {
				triggerSelectionHaptic()
				onPress()
			}}
			style={({ pressed }) => [
				styles.vaultRow,
				{ backgroundColor: pressed && IS_IOS ? colors.fill2 : colors.fill },
			]}
		>
			<View style={[styles.vaultBadge, { backgroundColor: vaultColor }]}>
				<Text style={[styles.vaultInitial, { color: colors.onTint }]}>
					{name.slice(0, 1).toLocaleUpperCase()}
				</Text>
			</View>
			<Text numberOfLines={1} style={[styles.vaultName, { color: colors.label }]}>
				{name}
			</Text>
			<SymbolIcon
				color={colors.secondaryLabel}
				name={{ sf: "chevron.up.chevron.down", md: "unfold_more" }}
				size={IS_IOS ? 14 : 20}
			/>
		</Pressable>
	)
}

export function SidebarContent({ closeSidebar }: { closeSidebar: () => void }) {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const databases = useDatabaseStore((state) => state.databases)
	const rowsByFolder = useDatabaseStore((state) => state.rowsByFolder)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const todayBadge = useTodayBadge()
	const [uiState, dispatchUi] = useReducer(sidebarUiReducer, initialSidebarUiState)
	const explorer = useFileExplorerActions({ closeSidebar, dispatchUi, uiState })
	const databaseEntries = useMemo(() => Object.values(databases), [databases])
	const treeView = explorer.treeView
	const updateCount = Object.keys(availableUpdates).length
	const syncStatus = useSyncStatusPresentation()
	const conflictCount = useSyncConflictCount()
	const syncLinked = useRemoteVaultStore((state) => state.linkedVaultId !== null)

	function navigate(action: () => void) {
		closeSidebar()
		action()
	}

	return (
		<View style={[styles.root, { paddingTop: insets.top + 8 }]}>
			<VaultSwitcherRow onPress={() => navigate(() => presentSheet("vault-switcher"))} />
			<FlatList
				ListFooterComponent={
					<View style={[styles.footer, { borderTopColor: colors.separator }]}>
						<SidebarRow
							icon={{ sf: "storefront", md: "storefront" }}
							label="Marketplace"
							onPress={() => navigate(() => openSettings("marketplace"))}
							trailing={
								updateCount > 0 ? `${updateCount} update${updateCount === 1 ? "" : "s"}` : undefined
							}
						/>
						<SidebarRow
							badge={conflictCount > 0 ? String(conflictCount) : undefined}
							icon={syncLinked ? syncStatus.icon : { sf: "icloud", md: "cloud" }}
							label="Sync"
							onPress={() => navigate(() => presentSheet("sync"))}
							trailing={conflictCount > 0 ? undefined : syncLinked ? syncStatus.label : "Off"}
						/>
						<SidebarRow
							icon={{ sf: "gearshape", md: "settings" }}
							label="Settings"
							onPress={() => navigate(() => openSettings())}
						/>
					</View>
				}
				ListHeaderComponent={
					<View>
						<SidebarRow
							badge={todayBadge}
							icon={{ sf: "checkmark.circle", md: "event_available" }}
							label="Today"
							onPress={() => navigate(() => router.navigate("/(tabs)/(today)" as never))}
						/>
						<PluginSidebarRows navigate={navigate} />
						{databaseEntries.length > 0 ? <SidebarSectionHeader label="Databases" /> : null}
						{databaseEntries.map((entry) => (
							<SidebarRow
								icon={{ sf: "tablecells", md: "table" }}
								key={entry.folderPath}
								label={entry.name}
								onPress={() => navigate(() => openDatabase(entry.folderPath))}
								trailing={String(
									Object.keys(rowsByFolder[entry.folderPath]?.rows ?? {}).length || "",
								)}
							/>
						))}
						{treeView.rows.length > 0 ? <SidebarSectionHeader label="Files" /> : null}
					</View>
				}
				contentContainerStyle={styles.listContent}
				contentInsetAdjustmentBehavior="never"
				data={treeView.rows}
				keyExtractor={(item) => item.node.path}
				onRefresh={explorer.handleRefresh}
				refreshing={false}
				renderItem={({ item }) => (
					<SidebarTreeRow
						active={activeFilePath === item.node.path}
						depth={item.depth}
						entry={item.node}
						expanded={uiState.expandedFolders.has(item.node.path)}
						menuGroups={explorer.entryMenuGroups(item.node)}
						onOpenNote={explorer.handleOpenNote}
						onToggleFolder={explorer.handleToggleFolder}
						title={item.title}
					/>
				)}
				style={styles.list}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	footer: {
		borderTopWidth: StyleSheet.hairlineWidth,
		marginTop: 12,
		paddingTop: 8,
	},
	list: {
		flex: 1,
	},
	listContent: {
		paddingBottom: 24,
	},
	root: {
		flex: 1,
		gap: 12,
		paddingBottom: 12,
		paddingHorizontal: 12,
	},
	vaultBadge: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 8,
		height: 28,
		justifyContent: "center",
		width: 28,
	},
	vaultInitial: {
		fontSize: 15,
		fontWeight: "700",
		lineHeight: 20,
	},
	vaultName: {
		flex: 1,
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	vaultRow: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 14 : 28,
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 52 : 56,
		overflow: "hidden",
		paddingHorizontal: 12,
	},
})
