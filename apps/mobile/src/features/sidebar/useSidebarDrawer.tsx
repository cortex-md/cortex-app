import { useEditorStore, useVaultStore } from "@cortex/core"
import { useRouter } from "expo-router"
import {
	FilePlus,
	FolderPlus,
	type LucideIcon,
	MoreHorizontal,
	Search,
	Settings,
	X,
} from "lucide-react-native"
import { useReducer } from "react"
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native"

import { EntryActionsSheet } from "@/features/file-explorer/EntryActionsSheet"
import { MoreActionsSheet } from "@/features/file-explorer/MoreActionsSheet"
import { MoveEntrySheet } from "@/features/file-explorer/MoveEntrySheet"
import { SidebarFileItem } from "@/features/file-explorer/SidebarFileItem"
import { TextActionSheet } from "@/features/file-explorer/TextActionSheet"
import { useFileExplorerActions } from "@/features/file-explorer/useFileExplorerActions"
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen"
import { PluginSidebarSection } from "@/features/sidebar/PluginSidebarSection"
import { initialSidebarUiState, sidebarUiReducer } from "@/features/sidebar/sidebarUiState"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"
import { WorkspaceSwitcher } from "@/features/vault/WorkspaceSwitcher"
import { WorkspaceSwitcherSheet } from "@/features/vault/WorkspaceSwitcherSheet"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

function SidebarIconButton({
	Icon,
	color,
	label,
	onPress,
}: {
	Icon: LucideIcon
	color: string
	label: string
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityLabel={label}
			hitSlop={6}
			onPress={onPress}
			style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.55 : 1 }]}
		>
			<Icon color={color} size={21} strokeWidth={2.25} />
		</Pressable>
	)
}

export function useSidebarDrawer(closeSidebar: () => void) {
	const router = useRouter()
	const { width } = useWindowDimensions()
	const { colors, iconColors, staticColors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [uiState, dispatchUi] = useReducer(sidebarUiReducer, initialSidebarUiState)
	const sidebarUi = { closeSidebar, dispatchUi, uiState }
	const explorer = useFileExplorerActions(sidebarUi)
	const switcher = useVaultSwitcher(sidebarUi)
	const drawerWidth = Math.min(Math.max(width * 0.86, 308), 390)

	const renderSidebar = () => (
		<View style={[styles.sidebar, { backgroundColor: staticColors.groupedBackground }]}>
			<View style={styles.topBar}>
				<WorkspaceSwitcher
					colors={colors}
					iconColors={iconColors}
					onPress={switcher.openSwitcher}
					vaultName={vault?.name ?? "Cortex"}
				/>
				<Pressable
					accessibilityLabel="Close sidebar"
					hitSlop={8}
					onPress={closeSidebar}
					style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.52 : 1 }]}
				>
					<X color={iconColors.secondary} size={20} strokeWidth={2.25} />
				</Pressable>
			</View>

			<View style={styles.actionBar}>
				<SidebarIconButton
					Icon={FilePlus}
					color={iconColors.tint}
					label="New note"
					onPress={explorer.openCreateNoteSheet}
				/>
				<SidebarIconButton
					Icon={FolderPlus}
					color={iconColors.tint}
					label="New folder"
					onPress={explorer.openCreateFolderSheet}
				/>
				<SidebarIconButton
					Icon={Search}
					color={iconColors.secondary}
					label="Search"
					onPress={() => {
						closeSidebar()
						router.push("/(search)" as never)
					}}
				/>
				<SidebarIconButton
					Icon={MoreHorizontal}
					color={iconColors.secondary}
					label="More"
					onPress={() => {
						triggerSelectionHaptic()
						dispatchUi({ presented: true, type: "set-more-presented" })
					}}
				/>
				<SidebarIconButton
					Icon={Settings}
					color={iconColors.secondary}
					label="Settings"
					onPress={() => {
						closeSidebar()
						router.push("/(settings)" as never)
					}}
				/>
			</View>

			<FlatList
				contentContainerStyle={styles.fileListContent}
				data={explorer.treeView.rows}
				keyExtractor={(item) => item.node.path}
				ListFooterComponent={<PluginSidebarSection closeSidebar={closeSidebar} />}
				ListEmptyComponent={
					<View style={styles.emptySidebar}>
						<Text selectable style={[styles.emptySidebarTitle, { color: colors.label }]}>
							No notes yet
						</Text>
						<Text selectable style={[styles.emptySidebarText, { color: colors.secondaryLabel }]}>
							Create a note or folder from the icons above.
						</Text>
					</View>
				}
				onRefresh={explorer.handleRefresh}
				refreshing={false}
				renderItem={({ item }) => (
					<SidebarFileItem
						active={activeFilePath === item.node.path}
						colors={colors}
						depth={item.depth}
						entry={item.node}
						expanded={uiState.expandedFolders.has(item.node.path)}
						iconColors={iconColors}
						onLongPress={explorer.handleOpenEntryActions}
						onOpenNote={explorer.handleOpenNote}
						onToggleFolder={explorer.handleToggleFolder}
						title={item.title}
					/>
				)}
				style={styles.fileList}
			/>

			<WorkspaceSwitcherSheet
				activeVaultUuid={vault?.uuid ?? null}
				isPresented={uiState.switcherPresented}
				onBrowseVault={switcher.handleBrowseVault}
				onDismiss={switcher.dismissSwitcher}
				onOpenRecentVault={switcher.handleOpenRecentVault}
				recentVaults={recentVaults}
				submitting={uiState.submitting}
			/>
			<MoreActionsSheet
				allFoldersExpanded={explorer.treeView.allExpanded}
				isPresented={uiState.morePresented}
				onDismiss={() => dispatchUi({ presented: false, type: "set-more-presented" })}
				onExpandCollapseAll={explorer.handleExpandCollapseAll}
				onRefresh={() => {
					dispatchUi({ presented: false, type: "set-more-presented" })
					explorer.handleRefresh()
				}}
			/>
			<EntryActionsSheet
				entry={uiState.entryActionsEntry}
				onAction={explorer.handleEntryAction}
				onDismiss={() => {
					if (!uiState.submitting) {
						dispatchUi({ entry: null, type: "set-entry-actions-entry" })
					}
				}}
				onPluginAction={explorer.handlePluginEntryAction}
				submitting={uiState.submitting}
			/>
			<MoveEntrySheet
				destinations={explorer.moveDestinations}
				entry={uiState.moveEntry}
				error={uiState.moveError}
				onDismiss={() => {
					if (!uiState.submitting) {
						dispatchUi({ entry: null, type: "set-move-entry" })
					}
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
					if (!uiState.submitting) {
						dispatchUi({ action: null, type: "set-text-action" })
					}
				}}
				onSubmit={(value) => {
					void explorer.handleSubmitTextAction(value)
				}}
				submitting={uiState.submitting}
			/>
			<Modal
				animationType="slide"
				onRequestClose={switcher.dismissPendingVaultFolder}
				presentationStyle="pageSheet"
				visible={uiState.pendingVaultFolder !== null}
			>
				<OnboardingScreen
					key={uiState.pendingVaultFolder?.path ?? "none"}
					initialFolder={uiState.pendingVaultFolder}
					onCancel={switcher.dismissPendingVaultFolder}
					onCreated={switcher.handleVaultCreated}
				/>
			</Modal>
		</View>
	)

	return {
		drawerBackgroundColor: staticColors.groupedBackground,
		drawerWidth,
		renderSidebar,
	}
}

const styles = StyleSheet.create({
	actionBar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		paddingBottom: 12,
		paddingHorizontal: 16,
	},
	actionButton: {
		alignItems: "center",
		borderRadius: 8,
		height: 34,
		justifyContent: "center",
		width: 34,
	},
	closeButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 36,
		minWidth: 36,
	},
	emptySidebar: {
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 18,
	},
	emptySidebarText: {
		fontSize: 14,
		letterSpacing: 0,
		lineHeight: 20,
	},
	emptySidebarTitle: {
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 21,
	},
	fileList: {
		flex: 1,
	},
	fileListContent: {
		paddingBottom: 16,
		paddingHorizontal: 8,
	},
	sidebar: {
		flex: 1,
		paddingTop: 56,
	},
	topBar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		paddingBottom: 12,
		paddingHorizontal: 16,
	},
})
