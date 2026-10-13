import { buildTagTree, selectSortedTags, useTagsStore } from "@cortex/core"
import { Stack } from "expo-router"
import { ArrowDownWideNarrow, ChevronRight, Tag } from "lucide-react-native"
import { useMemo, useState } from "react"
import {
	ActivityIndicator,
	FlatList,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native"

import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SearchField } from "@/components/ui/SearchField"
import { openTagPage } from "@/features/navigation/routes"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { resolveTagColor } from "@/features/tags/tagColors"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type TagSort = "count" | "name"

interface TagListItem {
	tag: string
	color: string | null
	count: number
}

const sortLabels: Record<TagSort, string> = {
	count: "Most notes",
	name: "Name",
}
const sortOrders = Object.keys(sortLabels) as TagSort[]

export function TagsScreen() {
	const { colors } = useMobileColors()
	const { openSidebar } = useMobileSidebar()
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const [filter, setFilter] = useState("")
	const [sort, setSort] = useState<TagSort>("count")
	const indexReady = useEnsureVaultIndexed()

	const needle = filter.trim().replace(/^#/, "").toLowerCase()
	const items = useMemo<TagListItem[]>(() => {
		const entries = selectSortedTags({ tagIndex, tagColors })
		const list: TagListItem[] = needle
			? entries
					.filter((entry) => entry.tag.toLowerCase().includes(needle))
					.map((entry) => ({ tag: entry.tag, color: entry.color, count: entry.filePaths.length }))
			: buildTagTree(entries).map((node) => ({ tag: node.tag, color: node.color, count: node.count }))
		if (sort === "name") return [...list].sort((a, b) => a.tag.localeCompare(b.tag))
		return list
	}, [needle, sort, tagColors, tagIndex])

	return (
		<>
			<FlatList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				data={items}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(item) => item.tag}
				ListEmptyComponent={
					needle ? (
						<EmptyState title={`No tags match “${filter.trim()}”`} />
					) : !indexReady ? (
						<View style={styles.loading}>
							<ActivityIndicator color={colors.tint} />
						</View>
					) : (
						<EmptyState
							description="Add #tags to your notes to see them here."
							Icon={Tag}
							title="No tags yet"
						/>
					)
				}
				ListHeaderComponent={
					<>
						<View style={styles.filter}>
							<SearchField
								accessibilityLabel="Filter tags"
								onChangeText={setFilter}
								onClear={() => setFilter("")}
								placeholder="Filter tags..."
								value={filter}
							/>
						</View>
						{items.length > 0 ? (
							<GroupedSectionHeader>
								{`${items.length} ${items.length === 1 ? "tag" : "tags"}`}
							</GroupedSectionHeader>
						) : null}
					</>
				}
				renderItem={({ item, index }) => (
					<View
						style={[
							styles.card,
							{ backgroundColor: colors.cell },
							index === 0 ? styles.first : null,
							index === items.length - 1 ? styles.last : null,
						]}
					>
						<Pressable
							accessibilityRole="button"
							android_ripple={{ color: colors.hover }}
							onPress={() => openTagPage(item.tag)}
							style={({ pressed }) => [
								styles.row,
								{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
							]}
						>
							<View style={styles.dotWrap}>
								<View
									style={[styles.dot, { backgroundColor: resolveTagColor(item.color, colors) }]}
								/>
							</View>
							<Text numberOfLines={1} style={[styles.name, { color: colors.label }]}>
								{item.tag}
							</Text>
							<Badge label={String(item.count)} />
							<ChevronRight
								color={colors.tertiaryLabel}
								size={IS_IOS ? 14 : 24}
								strokeWidth={2.4}
							/>
						</Pressable>
						{IS_IOS && index < items.length - 1 ? (
							<View style={[styles.separator, { backgroundColor: colors.separator }]} />
						) : null}
					</View>
				)}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			{IS_IOS ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button
							accessibilityLabel="Show sidebar"
							icon="sidebar.left"
							onPress={openSidebar}
						/>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Menu accessibilityLabel="More" icon="ellipsis" title="More">
							<Stack.Toolbar.Menu inline title="Sort by">
								{sortOrders.map((order) => (
									<Stack.Toolbar.MenuAction
										isOn={sort === order}
										key={order}
										onPress={() => setSort(order)}
									>
										{sortLabels[order]}
									</Stack.Toolbar.MenuAction>
								))}
							</Stack.Toolbar.Menu>
						</Stack.Toolbar.Menu>
					</Stack.Toolbar>
				</>
			) : (
				<Stack.Screen
					options={{
						headerLeft: () => <SidebarToggleButton />,
						headerRight: () => (
							<NativeMenu
								accessibilityLabel="More"
								groups={[
									sortOrders.map((order) => ({
										checked: sort === order,
										key: order,
										label: sortLabels[order],
										onPress: () => setSort(order),
									})),
								]}
								header="Sort by"
								icon={{ Lucide: ArrowDownWideNarrow, sf: "arrow.up.arrow.down" }}
							/>
						),
					}}
				/>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	card: {
		marginHorizontal: 16,
		overflow: "hidden",
	},
	content: {
		paddingBottom: 32,
	},
	dot: {
		borderRadius: 4,
		height: 14,
		width: 14,
	},
	dotWrap: {
		alignItems: "center",
		width: 30,
	},
	filter: {
		paddingBottom: 2,
		paddingTop: 4,
	},
	first: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	last: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	loading: {
		paddingVertical: 40,
	},
	name: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 58,
	},
})
