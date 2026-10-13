import {
	formatRelativeTime,
	getErrorMessage,
	getFolderNoteCounts,
	joinPath,
	selectSortedTags,
	useBookmarksStore,
	useTagsStore,
	useVaultStore,
} from "@cortex/core"
import { type Href, router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from "react-native"
import type { SearchBarCommands } from "react-native-screens"

import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon } from "@/components/ui/Symbol"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openNote } from "@/features/navigation/routes"
import { ListCell, ListSectionHeader, listCellStyles } from "@/features/search/ListCell"
import { HighlightedTitle, SearchSnippetText } from "@/features/search/SearchSnippetText"
import {
	type QuickFinderItem,
	type QuickFinderSort,
	useQuickFinderResults,
} from "@/features/search/useQuickFinderResults"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const EMPTY_TAGS: string[] = []
const FOCUS_DELAY_MS = 350

const sortLabels: Record<QuickFinderSort, string> = {
	best: "Best match",
	recent: "Recently edited",
}
const sortOrders = Object.keys(sortLabels) as QuickFinderSort[]

type QuickFinderParams = {
	folder?: string
	query?: string
	relinkBookmark?: string
}

function folderName(folder: string, vaultName: string): string {
	if (!folder) return vaultName
	return folder.slice(folder.lastIndexOf("/") + 1)
}

function openCommandPalette() {
	router.replace({ pathname: "/command-palette" } as Href)
}

export function QuickFinderSheet() {
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<QuickFinderParams>()
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const searchBarRef = useRef<SearchBarCommands>(null)
	const initialQueryRef = useRef(params.query ?? "")
	const [query, setQuery] = useState(() => params.query ?? "")
	const [folder, setFolder] = useState<string | null>(() => params.folder || null)
	const [selectedTags, setSelectedTags] = useState<string[]>(EMPTY_TAGS)
	const [titleOnly, setTitleOnly] = useState(false)
	const [sort, setSort] = useState<QuickFinderSort>("best")
	useEnsureVaultIndexed()

	useEffect(() => {
		const timer = setTimeout(() => {
			if (initialQueryRef.current) searchBarRef.current?.setText(initialQueryRef.current)
			if (IS_IOS) searchBarRef.current?.focus()
		}, FOCUS_DELAY_MS)
		return () => clearTimeout(timer)
	}, [])

	const filters = useMemo(
		() => ({ folder, tags: selectedTags, titleOnly, sort }),
		[folder, selectedTags, sort, titleOnly],
	)
	const { items, pending } = useQuickFinderResults(query, filters)
	const tags = useMemo(() => selectSortedTags({ tagIndex, tagColors }), [tagColors, tagIndex])
	const folders = useMemo(
		() => (vault ? getFolderNoteCounts(files, vault.path) : []),
		[files, vault],
	)
	const vaultName = vault?.name ?? "Vault"
	const trimmedQuery = query.trim()
	const relinkBookmark = params.relinkBookmark
	const exactMatch = items.some((item) => item.title.toLowerCase() === trimmedQuery.toLowerCase())
	const showCreate = Boolean(trimmedQuery) && !relinkBookmark && !exactMatch
	const filtered = Boolean(folder) || selectedTags.length > 0 || titleOnly

	const handleQueryChange = (text: string) => {
		if (text.startsWith(">")) {
			openCommandPalette()
			return
		}
		setQuery(text)
	}

	const handleOpen = (item: QuickFinderItem) => {
		dismissSheet()
		if (relinkBookmark && vault) {
			void useBookmarksStore
				.getState()
				.renameBookmarkPath(vault.path, relinkBookmark, item.filePath)
				.then(() => toast("Bookmark updated"))
				.catch((error: unknown) => toast(getErrorMessage(error)))
			return
		}
		openNote(item.filePath)
	}

	const handleCreate = async () => {
		if (!vault || !trimmedQuery) return
		const parentPath = folder ? joinPath(vault.path, folder) : vault.path
		try {
			const filePath = await useVaultStore.getState().createFile(parentPath, trimmedQuery)
			dismissSheet()
			openNote(filePath)
		} catch (error) {
			toast(getErrorMessage(error))
		}
	}

	const handleSubmit = () => {
		const needle = trimmedQuery.toLowerCase()
		const target = items.find((item) => item.title.toLowerCase() === needle) ?? items[0]
		if (target) handleOpen(target)
		else if (showCreate) void handleCreate()
	}

	const toggleTag = (tag: string) => {
		setSelectedTags((current) =>
			current.includes(tag) ? current.filter((candidate) => candidate !== tag) : [...current, tag],
		)
	}

	const title = relinkBookmark ? "Find note" : "Quick finder"
	const sectionTitle = trimmedQuery
		? `${items.length} ${items.length === 1 ? "note" : "notes"}`
		: "Recent"

	const androidGroups: MenuGroup[] = [
		[
			{ checked: !folder, key: "folder:any", label: "Any folder", onPress: () => setFolder(null) },
			...folders.map((entry) => ({
				checked: folder === entry.path,
				key: `folder:${entry.path}`,
				label: entry.path,
				onPress: () => setFolder(entry.path),
			})),
		],
		tags.map((entry) => ({
			checked: selectedTags.includes(entry.tag),
			key: `tag:${entry.tag}`,
			label: `#${entry.tag}`,
			onPress: () => toggleTag(entry.tag),
		})),
		[
			{
				checked: titleOnly,
				key: "title-only",
				label: "Titles only",
				onPress: () => setTitleOnly((current) => !current),
			},
			...sortOrders.map((order) => ({
				checked: sort === order,
				key: `sort:${order}`,
				label: sortLabels[order],
				onPress: () => setSort(order),
			})),
		],
		[
			{
				icon: { md: "terminal", sf: "terminal" },
				key: "commands",
				label: "Commands",
				onPress: openCommandPalette,
			},
		],
	].filter((group) => group.length > 0) as MenuGroup[]

	const header = IS_IOS ? (
		<>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button accessibilityLabel="Close" icon="xmark" onPress={dismissSheet} />
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu
					accessibilityLabel="Filters"
					icon={
						filtered
							? "line.3.horizontal.decrease.circle.fill"
							: "line.3.horizontal.decrease.circle"
					}
					title="Filters"
				>
					<Stack.Toolbar.Menu
						icon="folder"
						title={folder ? `Folder: ${folderName(folder, vaultName)}` : "Folder"}
					>
						<Stack.Toolbar.MenuAction isOn={!folder} onPress={() => setFolder(null)}>
							Any folder
						</Stack.Toolbar.MenuAction>
						{folders.map((entry) => (
							<Stack.Toolbar.MenuAction
								isOn={folder === entry.path}
								key={entry.path}
								onPress={() => setFolder(entry.path)}
							>
								{entry.path}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
					<Stack.Toolbar.Menu
						icon="number"
						title={selectedTags.length > 0 ? `Tags: ${selectedTags.length}` : "Tags"}
					>
						{tags.map((entry) => (
							<Stack.Toolbar.MenuAction
								isOn={selectedTags.includes(entry.tag)}
								key={entry.tag}
								onPress={() => toggleTag(entry.tag)}
								unstable_keepPresented
							>
								{`#${entry.tag}`}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
					<Stack.Toolbar.MenuAction
						icon="textformat"
						isOn={titleOnly}
						onPress={() => setTitleOnly((current) => !current)}
					>
						Titles only
					</Stack.Toolbar.MenuAction>
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
					<Stack.Toolbar.Menu inline>
						<Stack.Toolbar.MenuAction icon="terminal" onPress={openCommandPalette}>
							Commands
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
		</>
	) : null

	return (
		<>
			<Stack.Screen
				options={{
					headerLeft: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ md: "close", sf: "xmark" }}
									onPress={dismissSheet}
								/>
							),
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="Filters"
									groups={androidGroups}
									icon={{ md: "filter_list", sf: "line.3.horizontal.decrease.circle" }}
								/>
							),
					title,
				}}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				autoFocus
				hideNavigationBar={false}
				hideWhenScrolling={false}
				obscureBackground={false}
				onChangeText={(event) => handleQueryChange(event.nativeEvent.text)}
				onSearchButtonPress={handleSubmit}
				placeholder="Find or create a note"
				placement="stacked"
				ref={searchBarRef}
			/>
			{header}
			<FlatList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				data={items}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(item) => item.id}
				ListEmptyComponent={
					pending ? (
						<View style={styles.loading}>
							<ActivityIndicator color={colors.tint} />
						</View>
					) : showCreate ? null : (
						<EmptyState
							icon={{ md: "search", sf: "magnifyingglass" }}
							title={trimmedQuery ? "No matching notes" : "No recent notes"}
						/>
					)
				}
				ListHeaderComponent={
					<>
						{showCreate ? (
							<View style={styles.createGroup}>
								<ListCell first last onPress={() => void handleCreate()}>
									<SymbolIcon
										color={colors.tint}
										name={{ md: "add_circle", sf: "plus.circle.fill" }}
										size={22}
									/>
									<Text
										numberOfLines={1}
										style={[listCellStyles.title, styles.flex, { color: colors.tint }]}
									>
										{`Create “${trimmedQuery}”`}
									</Text>
								</ListCell>
							</View>
						) : null}
						{items.length > 0 ? <ListSectionHeader>{sectionTitle}</ListSectionHeader> : null}
					</>
				}
				renderItem={({ item, index }) => (
					<ListCell
						first={index === 0}
						last={index === items.length - 1}
						onPress={() => handleOpen(item)}
					>
						<View style={listCellStyles.body}>
							<HighlightedTitle query={trimmedQuery} title={item.title} />
							{item.snippet ? (
								<SearchSnippetText numberOfLines={1} snippet={item.snippet} />
							) : (
								<Text
									numberOfLines={1}
									style={[listCellStyles.subtitle, { color: colors.secondaryLabel }]}
								>
									{folderName(item.folder, vaultName)}
								</Text>
							)}
						</View>
						{item.modifiedAt ? (
							<Text style={[listCellStyles.value, { color: colors.secondaryLabel }]}>
								{formatRelativeTime(item.modifiedAt, "short")}
							</Text>
						) : null}
					</ListCell>
				)}
				style={{ backgroundColor: IS_IOS ? colors.groupedBackground : colors.background }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	createGroup: {
		marginTop: 12,
	},
	flex: {
		flex: 1,
	},
	loading: {
		paddingVertical: 24,
	},
})
