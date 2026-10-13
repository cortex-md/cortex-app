import { type Tab, useEditorStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { getParentPath, toVaultRelativePath } from "@cortex/platform/utils"
import { Stack } from "expo-router"
import { useState } from "react"
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon } from "@/components/ui/Symbol"
import {
	dismissSheet,
	openNote,
	openPluginViewRoute,
	presentSheet,
} from "@/features/navigation/routes"
import { NOTE_MENU_ICON, NOTE_MENU_LABEL } from "@/features/note/noteMenu"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const EMPTY_TABS: Tab[] = []

function tabFolder(tab: Tab, vaultPath: string | null): string | undefined {
	if (tab.tabType === "view" || !vaultPath) return undefined
	const folder = toVaultRelativePath(getParentPath(tab.filePath), vaultPath)
	return folder || undefined
}

function TabRow({
	active,
	folder,
	onClose,
	onOpen,
	tab,
}: {
	active: boolean
	folder: string | undefined
	onClose: () => void
	onOpen: () => void
	tab: Tab
}) {
	const { colors } = useMobileColors()
	const subtitle = tab.isDirty ? (folder ? `${folder} · Unsaved` : "Unsaved") : folder
	return (
		<View style={[styles.row, { backgroundColor: colors.cell }]}>
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ selected: active }}
				android_ripple={{ color: colors.hover }}
				onPress={onOpen}
				style={({ pressed }) => [
					styles.rowMain,
					{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
				]}
			>
				<SymbolIcon
					color={active ? colors.tint : colors.secondaryLabel}
					name={
						tab.tabType === "view"
							? { sf: "square.grid.2x2", md: "grid_view" }
							: { sf: "doc.text", md: "description" }
					}
					size={20}
				/>
				<View style={styles.rowText}>
					<Text
						numberOfLines={1}
						style={[styles.rowTitle, { color: active ? colors.tint : colors.label }]}
					>
						{tab.title}
					</Text>
					{subtitle ? (
						<Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.secondaryLabel }]}>
							{subtitle}
						</Text>
					) : null}
				</View>
			</Pressable>
			<Pressable
				accessibilityLabel={`Close ${tab.title}`}
				accessibilityRole="button"
				android_ripple={{ borderless: true, color: colors.hover }}
				hitSlop={6}
				onPress={onClose}
				style={styles.close}
			>
				<SymbolIcon
					color={colors.tertiaryLabel}
					name={{ sf: "xmark.circle.fill", md: "close" }}
					size={IS_IOS ? 20 : 22}
				/>
			</Pressable>
		</View>
	)
}

export function TabsScreen() {
	const { colors } = useMobileColors()
	const activePaneId = useWorkspaceStore((state) => state.activePaneId)
	const pane = useWorkspaceStore((state) => state.panes[state.activePaneId])
	const closeTab = useWorkspaceStore((state) => state.closeTab)
	const closeOtherTabs = useWorkspaceStore((state) => state.closeOtherTabs)
	const activateTab = useWorkspaceStore((state) => state.activateTab)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [query, setQuery] = useState("")
	const tabs = pane?.tabs ?? EMPTY_TABS
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const visibleTabs = normalizedQuery
		? tabs.filter((tab) => tab.title.toLocaleLowerCase().includes(normalizedQuery))
		: tabs
	const title = tabs.length === 1 ? "1 open tab" : `${tabs.length} open tabs`
	const menuGroups: MenuGroup[] = [
		[
			{
				key: "close-others",
				label: "Close other tabs",
				icon: { sf: "xmark.square", md: "tab_close" },
				disabled: !pane?.activeTabId || tabs.length < 2,
				onPress: () => {
					if (pane?.activeTabId) closeOtherTabs(pane.activeTabId, activePaneId)
				},
			},
		],
	]

	function openTab(tab: Tab) {
		activateTab(tab.id, activePaneId)
		dismissSheet()
		if (tab.tabType === "view" && tab.viewId) {
			openPluginViewRoute(tab.viewId)
			return
		}
		if (tab.filePath && tab.filePath !== activeFilePath) openNote(tab.filePath)
	}

	function newTab() {
		dismissSheet()
		presentSheet("quick-finder")
	}

	return (
		<>
			<Stack.Screen
				options={{
					title,
					headerLeft: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ sf: "xmark", md: "close" }}
									onPress={dismissSheet}
								/>
							),
					headerRight: IS_IOS
						? undefined
						: () => (
								<View style={styles.androidActions}>
									<HeaderIconButton
										accessibilityLabel="New tab"
										icon={{ sf: "plus", md: "add" }}
										onPress={newTab}
									/>
									<NativeMenu
										accessibilityLabel={NOTE_MENU_LABEL}
										groups={menuGroups}
										icon={NOTE_MENU_ICON}
									/>
								</View>
							),
				}}
			/>
			{IS_IOS ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button accessibilityLabel="New tab" icon="plus" onPress={newTab} />
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Menu icon="ellipsis" title="Tabs">
							{menuGroups[0]?.map((item) => (
								<Stack.Toolbar.MenuAction
									disabled={item.disabled}
									icon={item.icon?.sf}
									key={item.key}
									onPress={item.onPress}
								>
									{item.label}
								</Stack.Toolbar.MenuAction>
							))}
						</Stack.Toolbar.Menu>
						<Stack.Toolbar.Button onPress={dismissSheet} variant="done">
							Done
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				</>
			) : null}
			{tabs.length > 5 ? (
				<Stack.SearchBar
					autoCapitalize="none"
					hideWhenScrolling={false}
					onCancelButtonPress={() => setQuery("")}
					onChangeText={(event) => setQuery(event.nativeEvent.text)}
					placeholder="Search tabs"
				/>
			) : null}
			<FlatList
				ListEmptyComponent={
					<EmptyState
						icon={{ sf: "square.on.square", md: "tab" }}
						title={normalizedQuery ? "No matching tabs" : "No open tabs"}
					/>
				}
				contentContainerStyle={styles.list}
				contentInsetAdjustmentBehavior="automatic"
				data={visibleTabs}
				keyExtractor={(tab) => tab.id}
				renderItem={({ index, item }) => (
					<View
						style={[
							index === 0 ? styles.first : null,
							index === visibleTabs.length - 1 ? styles.last : null,
							styles.clip,
							{ backgroundColor: colors.cell },
						]}
					>
						{index > 0 ? (
							<View style={[styles.separator, { backgroundColor: colors.separator }]} />
						) : null}
						<TabRow
							active={item.id === pane?.activeTabId}
							folder={tabFolder(item, vaultPath)}
							onClose={() => closeTab(item.id, activePaneId)}
							onOpen={() => openTab(item)}
							tab={item}
						/>
					</View>
				)}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
		</>
	)
}

const RADIUS = IS_IOS ? 26 : 20

const styles = StyleSheet.create({
	androidActions: {
		alignItems: "center",
		flexDirection: "row",
	},
	clip: {
		marginHorizontal: 16,
		overflow: "hidden",
	},
	close: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	first: {
		borderTopLeftRadius: RADIUS,
		borderTopRightRadius: RADIUS,
	},
	last: {
		borderBottomLeftRadius: RADIUS,
		borderBottomRightRadius: RADIUS,
	},
	list: {
		paddingBottom: 32,
		paddingTop: 16,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: IS_IOS ? 52 : 64,
		paddingRight: 4,
	},
	rowMain: {
		alignItems: "center",
		alignSelf: "stretch",
		flex: 1,
		flexDirection: "row",
		gap: 12,
		paddingLeft: 16,
		paddingVertical: 8,
	},
	rowSubtitle: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: 18,
	},
	rowText: {
		flex: 1,
		gap: 1,
		minWidth: 0,
	},
	rowTitle: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 48,
	},
})
