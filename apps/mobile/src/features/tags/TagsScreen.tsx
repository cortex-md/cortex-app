import { buildTagTree, selectSortedTags, useTagsStore, useVaultStore } from "@cortex/core"
import { type Href, router, Stack } from "expo-router"
import { useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { Symbol } from "@/components/ui/Symbol"
import { openTagPage } from "@/features/navigation/routes"
import { ListCell, ListSectionHeader, listCellStyles } from "@/features/search/ListCell"
import { RowContextMenu } from "@/features/search/RowContextMenu"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { getTagColorChoices, promptRenameTag, setTagColorInVault } from "@/features/tags/tagActions"
import { getTagColorOptions, resolveTagColor } from "@/features/tags/tagColors"
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
	const vaultPath = useVaultStore((state) => state.vault?.path ?? "")
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const [filter, setFilter] = useState("")
	const [sort, setSort] = useState<TagSort>("count")
	const indexReady = useEnsureVaultIndexed()
	const colorChoices = getTagColorChoices(getTagColorOptions(colors))

	const needle = filter.trim().replace(/^#/, "").toLowerCase()
	const items = useMemo<TagListItem[]>(() => {
		const entries = selectSortedTags({ tagIndex, tagColors })
		const list: TagListItem[] = needle
			? entries
					.filter((entry) => entry.tag.toLowerCase().includes(needle))
					.map((entry) => ({ tag: entry.tag, color: entry.color, count: entry.filePaths.length }))
			: buildTagTree(entries).map((node) => ({
					tag: node.tag,
					color: node.color,
					count: node.count,
				}))
		if (sort === "name") return [...list].sort((a, b) => a.tag.localeCompare(b.tag))
		return list
	}, [needle, sort, tagColors, tagIndex])

	const searchInTag = (tag: string) => {
		router.navigate({ pathname: "/(tabs)/(search)", params: { tag } } as Href)
	}

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
						<EmptyState
							icon={{ md: "search_off", sf: "magnifyingglass" }}
							title={`No tags match “${filter.trim()}”`}
						/>
					) : !indexReady ? (
						<View style={styles.loading}>
							<ActivityIndicator color={colors.tint} />
						</View>
					) : (
						<EmptyState
							description="Add #tags to your notes to see them here."
							icon={{ md: "tag", sf: "number" }}
							title="No tags yet"
						/>
					)
				}
				ListHeaderComponent={
					items.length > 0 ? (
						<ListSectionHeader>
							{`${items.length} ${items.length === 1 ? "tag" : "tags"}`}
						</ListSectionHeader>
					) : null
				}
				renderItem={({ item, index }) => (
					<RowContextMenu
						entries={[
							{
								icon: "magnifyingglass",
								key: "search",
								label: "Search in tag",
								onPress: () => searchInTag(item.tag),
							},
							{
								icon: "pencil",
								key: "rename",
								label: "Rename…",
								onPress: () => promptRenameTag(vaultPath, item.tag),
							},
							{
								actions: colorChoices.map((choice) => ({
									isOn: item.color === choice.value,
									key: choice.key,
									label: choice.label,
									onPress: () => setTagColorInVault(vaultPath, item.tag, choice.value),
								})),
								icon: "paintpalette",
								key: "colour",
								label: "Colour",
							},
						]}
						href={{ pathname: "/tag", params: { tag: item.tag } } as Href}
						onPress={() => openTagPage(item.tag)}
					>
						{(onPress) => (
							<ListCell
								first={index === 0}
								last={index === items.length - 1}
								onPress={onPress}
								separatorInset={56}
							>
								<View style={styles.dotWrap}>
									<View
										style={[styles.dot, { backgroundColor: resolveTagColor(item.color, colors) }]}
									/>
								</View>
								<Text
									numberOfLines={1}
									style={[listCellStyles.title, styles.name, { color: colors.label }]}
								>
									{item.tag}
								</Text>
								<Text style={[listCellStyles.value, { color: colors.secondaryLabel }]}>
									{String(item.count)}
								</Text>
								<Symbol
									color={colors.tertiaryLabel}
									name={{ md: "chevron_right", sf: "chevron.right" }}
									size={IS_IOS ? 13 : 24}
								/>
							</ListCell>
						)}
					</RowContextMenu>
				)}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				hideWhenScrolling={false}
				onCancelButtonPress={() => setFilter("")}
				onChangeText={(event) => setFilter(event.nativeEvent.text)}
				placeholder="Filter tags"
			/>
			{IS_IOS ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button
							accessibilityLabel="Open sidebar"
							icon="sidebar.left"
							onPress={openSidebar}
						/>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Menu
							accessibilityLabel="Sort"
							icon="arrow.up.arrow.down"
							title="Sort by"
						>
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
								accessibilityLabel="Sort"
								groups={[
									sortOrders.map((order) => ({
										checked: sort === order,
										key: order,
										label: sortLabels[order],
										onPress: () => setSort(order),
									})),
								]}
								header="Sort by"
								icon={{ md: "sort", sf: "arrow.up.arrow.down" }}
							/>
						),
					}}
				/>
			)}
		</>
	)
}

const styles = StyleSheet.create({
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
		width: 28,
	},
	loading: {
		paddingVertical: 40,
	},
	name: {
		flex: 1,
	},
})
