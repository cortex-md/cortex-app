import { type Tab, useEditorStore, useWorkspaceStore } from "@cortex/core"
import { router } from "expo-router"
import { ArrowLeft, Check, FileText, MoreVertical, Plus, Store, X } from "lucide-react-native"
import { useState } from "react"
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { NativeMenu } from "@/components/ui/NativeMenu"
import { SearchField } from "@/components/ui/SearchField"
import { dismissSheet, openNote, openPluginViewRoute, presentSheet } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"
const EMPTY_TABS: Tab[] = []
const SKELETON_WIDTHS = ["86%", "64%", "92%", "48%", "78%", "70%"] as const

function TabPreview({ colors, tab }: { colors: MobileColors; tab: Tab }) {
	return (
		<View style={styles.preview}>
			{tab.tabType === "view" ? (
				<View style={[styles.viewTile, { backgroundColor: colors.accentSubtle }]}>
					<Store color={colors.tint} size={28} strokeWidth={1.8} />
				</View>
			) : (
				SKELETON_WIDTHS.map((width, index) => (
					<View
						key={index}
						style={[
							styles.skeleton,
							{
								backgroundColor: index === 0 ? colors.fill2 : colors.fill,
								height: index === 0 ? 12 : 8,
								width,
							},
						]}
					/>
				))
			)}
		</View>
	)
}

function TabCard({
	active,
	onClose,
	onOpen,
	tab,
}: {
	active: boolean
	onClose: () => void
	onOpen: () => void
	tab: Tab
}) {
	const { colors } = useMobileColors()
	const Icon = tab.tabType === "view" ? Store : FileText

	if (!IS_IOS) {
		return (
			<View style={[styles.androidCard, { backgroundColor: colors.fill }]}>
				<Pressable
					android_ripple={{ color: colors.hover }}
					onPress={onOpen}
					style={[
						styles.androidHeader,
						{ backgroundColor: active ? colors.tintFill : "transparent" },
					]}
				>
					<Icon color={active ? colors.onTint : colors.secondaryLabel} size={18} strokeWidth={2} />
					<Text
						numberOfLines={1}
						style={[styles.androidTitle, { color: active ? colors.onTint : colors.label }]}
					>
						{tab.title}
					</Text>
					<Pressable accessibilityLabel={`Close ${tab.title}`} hitSlop={8} onPress={onClose}>
						<X color={active ? colors.onTint : colors.secondaryLabel} size={18} strokeWidth={2.2} />
					</Pressable>
				</Pressable>
				<Pressable onPress={onOpen} style={[styles.androidBody, { backgroundColor: colors.background }]}>
					<TabPreview colors={colors} tab={tab} />
				</Pressable>
			</View>
		)
	}

	return (
		<View style={styles.iosCardWrap}>
			<Pressable
				accessibilityLabel={tab.title}
				accessibilityRole="button"
				onPress={onOpen}
				style={[
					styles.iosCard,
					{
						backgroundColor: colors.background,
						borderColor: active ? colors.tint : colors.separator,
						borderWidth: active ? 3 : StyleSheet.hairlineWidth,
					},
				]}
			>
				<TabPreview colors={colors} tab={tab} />
				<Pressable
					accessibilityLabel={`Close ${tab.title}`}
					hitSlop={6}
					onPress={onClose}
					style={[
						styles.iosClose,
						{ backgroundColor: colors.glass, borderColor: colors.glassEdge },
					]}
				>
					<X color={colors.label} size={14} strokeWidth={2.6} />
				</Pressable>
			</Pressable>
			<View style={styles.caption}>
				<Icon color={colors.secondaryLabel} size={14} strokeWidth={2.2} />
				<Text numberOfLines={1} style={[styles.captionLabel, { color: colors.label }]}>
					{tab.title}
				</Text>
			</View>
			{tab.isDirty ? (
				<View style={styles.dirty}>
					<View style={[styles.dirtyDot, { backgroundColor: colors.warningText }]} />
					<Text style={[styles.dirtyLabel, { color: colors.secondaryLabel }]}>Unsaved</Text>
				</View>
			) : null}
		</View>
	)
}

export function TabsScreen() {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const activePaneId = useWorkspaceStore((state) => state.activePaneId)
	const pane = useWorkspaceStore((state) => state.panes[state.activePaneId])
	const closeTab = useWorkspaceStore((state) => state.closeTab)
	const closeOtherTabs = useWorkspaceStore((state) => state.closeOtherTabs)
	const activateTab = useWorkspaceStore((state) => state.activateTab)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [query, setQuery] = useState("")
	const tabs = pane?.tabs ?? EMPTY_TABS
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const visibleTabs = normalizedQuery
		? tabs.filter((tab) => tab.title.toLocaleLowerCase().includes(normalizedQuery))
		: tabs
	const countLabel = `${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"}`

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
		<View style={[styles.root, { backgroundColor: colors.groupedBackground, paddingTop: insets.top }]}>
			{IS_IOS ? (
				<View style={styles.iosSearch}>
					<SearchField
						onChangeText={setQuery}
						onClear={() => setQuery("")}
						placeholder="Search tabs"
						value={query}
					/>
				</View>
			) : (
				<View style={styles.androidBar}>
					<Pressable
						accessibilityLabel="Back"
						android_ripple={{ borderless: true, color: colors.hover }}
						onPress={() => router.back()}
						style={styles.iconButton}
					>
						<ArrowLeft color={colors.label} size={24} strokeWidth={2} />
					</Pressable>
					<Text style={[styles.androidBarTitle, { color: colors.label }]}>{countLabel}</Text>
					<NativeMenu
						accessibilityLabel="More options"
						groups={[
							[
								{
									key: "close-others",
									label: "Close other tabs",
									disabled: !pane?.activeTabId,
									onPress: () => {
										if (pane?.activeTabId) closeOtherTabs(pane.activeTabId, activePaneId)
									},
								},
							],
						]}
						icon={{ sf: "ellipsis", Lucide: MoreVertical }}
					/>
				</View>
			)}
			<FlatList
				columnWrapperStyle={styles.column}
				contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 120 }]}
				data={visibleTabs}
				keyExtractor={(tab) => tab.id}
				numColumns={2}
				renderItem={({ item }) => (
					<View style={styles.cell}>
						<TabCard
							active={item.id === pane?.activeTabId}
							onClose={() => closeTab(item.id, activePaneId)}
							onOpen={() => openTab(item)}
							tab={item}
						/>
					</View>
				)}
			/>
			{IS_IOS ? (
				<View style={[styles.iosToolbar, { bottom: insets.bottom + 8 }]}>
					<Pressable
						accessibilityLabel="New tab"
						onPress={newTab}
						style={[styles.iosRound, { backgroundColor: colors.glass, borderColor: colors.glassEdge }]}
					>
						<Plus color={colors.label} size={22} strokeWidth={2.2} />
					</Pressable>
					<Text style={[styles.iosCount, { color: colors.label }]}>{countLabel}</Text>
					<Pressable
						accessibilityLabel="Done"
						onPress={dismissSheet}
						style={[styles.iosRound, { backgroundColor: colors.tintFill, borderColor: colors.tintFill }]}
					>
						<Check color={colors.onTint} size={22} strokeWidth={2.6} />
					</Pressable>
				</View>
			) : (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					onPress={newTab}
					style={[styles.fab, { backgroundColor: colors.accentSubtle, bottom: insets.bottom + 40 }]}
				>
					<Plus color={colors.tint} size={24} strokeWidth={2.2} />
					<Text style={[styles.fabLabel, { color: colors.tint }]}>New tab</Text>
				</Pressable>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	androidBar: {
		alignItems: "center",
		flexDirection: "row",
		height: 64,
		paddingHorizontal: 4,
	},
	androidBarTitle: {
		flex: 1,
		fontSize: 22,
		lineHeight: 28,
		marginLeft: 4,
	},
	androidBody: {
		height: 200,
		margin: 4,
		marginTop: 0,
		borderRadius: 16,
		overflow: "hidden",
	},
	androidCard: {
		borderCurve: "continuous",
		borderRadius: 20,
		overflow: "hidden",
	},
	androidHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		height: 44,
		paddingHorizontal: 12,
	},
	androidTitle: {
		flex: 1,
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 20,
	},
	caption: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		justifyContent: "center",
		paddingHorizontal: 8,
	},
	captionLabel: {
		flexShrink: 1,
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	cell: {
		flex: 1,
	},
	column: {
		gap: 16,
	},
	dirty: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		justifyContent: "center",
	},
	dirtyDot: {
		borderRadius: 999,
		height: 6,
		width: 6,
	},
	dirtyLabel: {
		fontSize: 12,
		lineHeight: 16,
	},
	fab: {
		alignItems: "center",
		borderRadius: 16,
		flexDirection: "row",
		gap: 12,
		height: 56,
		overflow: "hidden",
		paddingHorizontal: 20,
		position: "absolute",
		right: 16,
	},
	fabLabel: {
		fontSize: 16,
		fontWeight: "500",
		lineHeight: 24,
	},
	grid: {
		gap: 20,
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	iconButton: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	iosCard: {
		borderCurve: "continuous",
		borderRadius: 24,
		height: 236,
		overflow: "hidden",
	},
	iosCardWrap: {
		gap: 8,
	},
	iosClose: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		height: 30,
		justifyContent: "center",
		position: "absolute",
		right: 8,
		top: 8,
		width: 30,
	},
	iosCount: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	iosRound: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		height: 52,
		justifyContent: "center",
		width: 52,
	},
	iosSearch: {
		paddingBottom: 4,
		paddingTop: 8,
	},
	iosToolbar: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		left: 16,
		position: "absolute",
		right: 16,
	},
	preview: {
		flex: 1,
		gap: 10,
		padding: 16,
	},
	root: {
		flex: 1,
	},
	skeleton: {
		borderRadius: 4,
	},
	viewTile: {
		alignItems: "center",
		borderRadius: 16,
		flex: 1,
		justifyContent: "center",
	},
})
