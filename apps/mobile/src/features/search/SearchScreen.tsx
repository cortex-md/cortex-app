import {
	getFolderNoteCounts,
	getParentPath,
	joinPath,
	selectSortedTags,
	useTagsStore,
	useVaultStore,
} from "@cortex/core"
import { type SearchResult, useSearchStore } from "@cortex/search"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
	ActivityIndicator,
	FlatList,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native"
import type { SearchBarCommands } from "react-native-screens"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList } from "@/components/ui/GroupedList"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { openNote } from "@/features/navigation/routes"
import { SearchSnippetText } from "@/features/search/SearchSnippetText"
import { SearchSuggestions } from "@/features/search/SearchSuggestions"
import {
	buildRawQuery,
	extractCompleteFilters,
	formatFilter,
	formatResultsMeta,
	getSearchMode,
	type SearchFilter,
	type SearchQueryState,
} from "@/features/search/searchQuery"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"
const SEARCH_DEBOUNCE_MS = 150
const EMPTY_FILTERS: SearchFilter[] = []

function SearchResultGroup({
	active,
	colors,
	onOpen,
	result,
	vaultName,
	vaultPath,
}: {
	active: boolean
	colors: MobileColors
	onOpen: (filePath: string, matchIndex: number) => void
	result: SearchResult
	vaultName: string
	vaultPath: string
}) {
	const filePath = joinPath(vaultPath, result.id)
	const folder = getParentPath(result.id)
	const matches = result.matchCount || result.snippets.length
	return (
		<View style={styles.group}>
			<GroupedList>
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					onPress={() => onOpen(filePath, 0)}
					style={({ pressed }) => [
						styles.groupHeader,
						{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
					]}
				>
					<View style={styles.groupTitles}>
						<Text numberOfLines={1} style={[styles.groupTitle, { color: colors.label }]}>
							{result.title}
						</Text>
						<Text numberOfLines={1} style={[styles.groupPath, { color: colors.secondaryLabel }]}>
							{folder ? folder.slice(folder.lastIndexOf("/") + 1) : vaultName}
						</Text>
					</View>
					<Text style={[styles.groupCount, { color: colors.secondaryLabel }]}>
						{String(matches)}
					</Text>
				</Pressable>
				{result.snippets.map((snippet, index) => {
					const matchIndex = result.snippets
						.slice(0, index)
						.reduce((total, candidate) => total + candidate.ranges.length, 0)
					return (
						<Pressable
							accessibilityRole="button"
							android_ripple={{ color: colors.hover }}
							key={snippet.text}
							onPress={() => onOpen(filePath, matchIndex)}
							style={({ pressed }) => [
								styles.hit,
								{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
							]}
						>
							<SearchSnippetText active={active && index === 0} snippet={snippet} />
						</Pressable>
					)
				})}
			</GroupedList>
		</View>
	)
}

export function SearchScreen() {
	const { colors } = useMobileColors()
	const { openSidebar } = useMobileSidebar()
	const { tag: tagParam } = useLocalSearchParams<{ tag?: string }>()
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const results = useSearchStore((state) => state.results)
	const storeQuery = useSearchStore((state) => state.query)
	const indexing = useSearchStore((state) => state.indexing)
	const searchBarRef = useRef<SearchBarCommands>(null)
	const [state, setState] = useState<SearchQueryState>({ filters: EMPTY_FILTERS, text: "" })
	const [appliedTagParam, setAppliedTagParam] = useState<string | undefined>(undefined)
	const [barRequest, setBarRequest] = useState<{ id: number; text: string } | null>(null)
	useEnsureVaultIndexed()

	const setBarText = (text: string) => {
		setBarRequest((current) => ({ id: (current?.id ?? 0) + 1, text }))
	}

	if (tagParam !== appliedTagParam) {
		setAppliedTagParam(tagParam)
		if (tagParam) {
			setState({ filters: [{ key: "tag", value: tagParam }], text: "" })
			setBarText("")
		}
	}

	const raw = buildRawQuery(state)
	const mode = getSearchMode(state)
	const vaultPath = vault?.path ?? ""
	const vaultName = vault?.name ?? "Vault"

	useEffect(() => {
		if (barRequest) searchBarRef.current?.setText(barRequest.text)
	}, [barRequest])

	useEffect(() => {
		if (mode.kind !== "results") return
		const timer = setTimeout(() => {
			void useSearchStore.getState().runQuery(raw)
		}, SEARCH_DEBOUNCE_MS)
		return () => clearTimeout(timer)
	}, [mode.kind, raw])

	const folders = useMemo(
		() => (vault ? getFolderNoteCounts(files, vault.path) : []),
		[files, vault],
	)
	const tags = useMemo(() => selectSortedTags({ tagIndex, tagColors }), [tagColors, tagIndex])
	const folderScope = state.filters.find((filter) => filter.key === "path")?.value ?? null
	const tagScope = state.filters
		.filter((filter) => filter.key === "tag")
		.map((filter) => filter.value)
	const fileFilters = state.filters.filter((filter) => filter.key === "file")
	const hasFilters = state.filters.length > 0

	const applyState = (next: SearchQueryState) => {
		const extracted = extractCompleteFilters(next.filters, next.text)
		setState(extracted)
		setBarText(extracted.text)
	}

	const handleChangeText = (text: string) => {
		const extracted = extractCompleteFilters(state.filters, text)
		setState(extracted)
		if (extracted.text !== text) setBarText(extracted.text)
	}

	const handleSubmit = () => {
		if (!raw.trim()) return
		useSearchStore.getState().addRecentQuery(raw)
		void useSearchStore.getState().runQuery(raw)
	}

	const setFilters = (filters: SearchFilter[]) => {
		setState((current) => ({ ...current, filters }))
	}

	const setFolderScope = (path: string | null) => {
		const rest = state.filters.filter((filter) => filter.key !== "path")
		setFilters(path ? [...rest, { key: "path", value: path }] : rest)
	}

	const toggleTagScope = (tag: string) => {
		const exists = tagScope.includes(tag)
		setFilters(
			exists
				? state.filters.filter((filter) => !(filter.key === "tag" && filter.value === tag))
				: [...state.filters, { key: "tag", value: tag }],
		)
	}

	const removeFilter = (filter: SearchFilter) => {
		setFilters(
			state.filters.filter((candidate) => formatFilter(candidate) !== formatFilter(filter)),
		)
	}

	const replaceActiveWord = (replacement: string) => {
		const start = state.text.search(/\S*$/)
		applyState({ filters: state.filters, text: `${state.text.slice(0, start)}${replacement}` })
	}

	const openMatch = (filePath: string, matchIndex: number) => {
		useSearchStore.getState().setNoteHighlight({ filePath, query: storeQuery, matchIndex })
		openNote(filePath)
	}

	const androidGroups: MenuGroup[] = [
		[
			{
				checked: !folderScope,
				key: "folder:any",
				label: "Any folder",
				onPress: () => setFolderScope(null),
			},
			...folders.map((folder) => ({
				checked: folderScope === folder.path,
				key: `folder:${folder.path}`,
				label: folder.path,
				onPress: () => setFolderScope(folder.path),
			})),
		],
		tags.map((entry) => ({
			checked: tagScope.includes(entry.tag),
			key: `tag:${entry.tag}`,
			label: `#${entry.tag}`,
			onPress: () => toggleTagScope(entry.tag),
		})),
		fileFilters.map((filter) => ({
			checked: true,
			key: formatFilter(filter),
			label: `File: ${filter.value}`,
			onPress: () => removeFilter(filter),
		})),
		hasFilters
			? [
					{
						destructive: true,
						key: "clear",
						label: "Clear filters",
						onPress: () => setFilters(EMPTY_FILTERS),
					},
				]
			: [],
	].filter((group) => group.length > 0)

	const header = (
		<>
			<Stack.Screen
				options={{
					headerLeft: IS_IOS ? undefined : () => <SidebarToggleButton />,
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="Search scope"
									groups={androidGroups}
									header="Search in"
									icon={{ md: "filter_list", sf: "line.3.horizontal.decrease.circle" }}
								/>
							),
					title: "Search",
				}}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				hideWhenScrolling={false}
				onCancelButtonPress={() => setState({ filters: EMPTY_FILTERS, text: "" })}
				onChangeText={(event) => handleChangeText(event.nativeEvent.text)}
				onSearchButtonPress={handleSubmit}
				placeholder="Search in vault"
				ref={searchBarRef}
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
							accessibilityLabel="Search scope"
							icon={
								hasFilters
									? "line.3.horizontal.decrease.circle.fill"
									: "line.3.horizontal.decrease.circle"
							}
							title="Search in"
						>
							<Stack.Toolbar.Menu
								icon="folder"
								title={folderScope ? `Folder: ${folderScope}` : "Folder"}
							>
								<Stack.Toolbar.MenuAction isOn={!folderScope} onPress={() => setFolderScope(null)}>
									Any folder
								</Stack.Toolbar.MenuAction>
								{folders.map((folder) => (
									<Stack.Toolbar.MenuAction
										isOn={folderScope === folder.path}
										key={folder.path}
										onPress={() => setFolderScope(folder.path)}
									>
										{folder.path}
									</Stack.Toolbar.MenuAction>
								))}
							</Stack.Toolbar.Menu>
							<Stack.Toolbar.Menu
								icon="number"
								title={tagScope.length > 0 ? `Tags: ${tagScope.length}` : "Tags"}
							>
								{tags.map((entry) => (
									<Stack.Toolbar.MenuAction
										isOn={tagScope.includes(entry.tag)}
										key={entry.tag}
										onPress={() => toggleTagScope(entry.tag)}
										unstable_keepPresented
									>
										{`#${entry.tag}`}
									</Stack.Toolbar.MenuAction>
								))}
							</Stack.Toolbar.Menu>
							<Stack.Toolbar.Menu inline>
								{fileFilters.map((filter) => (
									<Stack.Toolbar.MenuAction
										icon="doc"
										isOn
										key={formatFilter(filter)}
										onPress={() => removeFilter(filter)}
									>
										{`File: ${filter.value}`}
									</Stack.Toolbar.MenuAction>
								))}
								<Stack.Toolbar.MenuAction
									destructive
									hidden={!hasFilters}
									icon="xmark.circle"
									onPress={() => setFilters(EMPTY_FILTERS)}
								>
									Clear filters
								</Stack.Toolbar.MenuAction>
							</Stack.Toolbar.Menu>
						</Stack.Toolbar.Menu>
					</Stack.Toolbar>
				</>
			) : null}
		</>
	)

	if (mode.kind === "results") {
		const activeQuery = storeQuery === raw
		const meta = formatResultsMeta(results, state.filters)
		return (
			<>
				<FlatList
					contentContainerStyle={styles.listContent}
					contentInsetAdjustmentBehavior="automatic"
					data={activeQuery ? results : []}
					keyboardDismissMode="on-drag"
					keyboardShouldPersistTaps="handled"
					keyExtractor={(result) => result.id}
					ListEmptyComponent={
						indexing || !activeQuery ? (
							<View style={styles.loading}>
								<ActivityIndicator color={colors.tint} />
								<Text style={[styles.loadingText, { color: colors.secondaryLabel }]}>
									{indexing ? "Indexing vault…" : "Searching…"}
								</Text>
							</View>
						) : (
							<EmptyState
								description={
									hasFilters ? "Try another word or clear the filters." : "Try another word."
								}
								icon={{ md: "search_off", sf: "magnifyingglass" }}
								title={state.text.trim() ? `No results for “${state.text.trim()}”` : "No results"}
							/>
						)
					}
					ListHeaderComponent={
						activeQuery && results.length > 0 ? (
							<Text style={[styles.meta, { color: colors.secondaryLabel }]}>{meta}</Text>
						) : null
					}
					renderItem={({ item, index }) => (
						<SearchResultGroup
							active={index === 0}
							colors={colors}
							onOpen={openMatch}
							result={item}
							vaultName={vaultName}
							vaultPath={vaultPath}
						/>
					)}
					style={{ backgroundColor: colors.groupedBackground }}
				/>
				{header}
			</>
		)
	}

	return (
		<>
			<SearchSuggestions
				folders={folders}
				mode={mode}
				onApplyQuery={applyState}
				onReplaceActiveWord={replaceActiveWord}
				tags={tags}
			/>
			{header}
		</>
	)
}

const styles = StyleSheet.create({
	group: {
		marginBottom: 10,
	},
	groupCount: {
		fontSize: IS_IOS ? 15 : 14,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
	},
	groupHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 56 : 64,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	groupPath: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	groupTitle: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: IS_IOS ? "600" : "500",
		lineHeight: IS_IOS ? 22 : 24,
	},
	groupTitles: {
		flex: 1,
		minWidth: 0,
	},
	hit: {
		minHeight: 44,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	listContent: {
		paddingBottom: 32,
	},
	loading: {
		alignItems: "center",
		gap: 10,
		paddingVertical: 40,
	},
	loadingText: {
		fontSize: 15,
		lineHeight: 20,
	},
	meta: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: 18,
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 12,
	},
})
