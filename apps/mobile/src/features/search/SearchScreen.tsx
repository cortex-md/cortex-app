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
import { ChevronRight, Search } from "lucide-react-native"
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

import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { FilterChip } from "@/components/ui/FilterChip"
import { GroupedList } from "@/components/ui/GroupedList"
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
	collapsed,
	colors,
	onOpen,
	onToggle,
	result,
	vaultPath,
}: {
	active: boolean
	collapsed: boolean
	colors: MobileColors
	onOpen: (filePath: string, matchIndex: number) => void
	onToggle: () => void
	result: SearchResult
	vaultPath: string
}) {
	const filePath = joinPath(vaultPath, result.id)
	const folder = getParentPath(result.id)
	return (
		<View style={styles.group}>
			<GroupedList>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ expanded: !collapsed }}
					android_ripple={{ color: colors.hover }}
					onPress={onToggle}
					style={({ pressed }) => [
						styles.groupHeader,
						{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
					]}
				>
					<ChevronRight
						color={colors.tertiaryLabel}
						size={18}
						strokeWidth={2.4}
						style={{ transform: [{ rotate: collapsed ? "0deg" : "90deg" }] }}
					/>
					<View style={styles.groupTitles}>
						<Text numberOfLines={1} style={[styles.groupTitle, { color: colors.label }]}>
							{result.title}
						</Text>
						<Text numberOfLines={1} style={[styles.groupPath, { color: colors.secondaryLabel }]}>
							{folder || "Vault root"}
						</Text>
					</View>
					<Badge label={String(result.matchCount || result.snippets.length)} />
				</Pressable>
				{collapsed
					? null
					: result.snippets.map((snippet, index) => {
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
	const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
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

	const removeFilter = (filter: SearchFilter) => {
		setState((current) => ({
			...current,
			filters: current.filters.filter(
				(candidate) => formatFilter(candidate) !== formatFilter(filter),
			),
		}))
	}

	const replaceActiveWord = (replacement: string) => {
		const start = state.text.search(/\S*$/)
		applyState({ filters: state.filters, text: `${state.text.slice(0, start)}${replacement}` })
	}

	const openMatch = (filePath: string, matchIndex: number) => {
		useSearchStore.getState().setNoteHighlight({ filePath, query: storeQuery, matchIndex })
		openNote(filePath)
	}

	const toggleCollapsed = (id: string) => {
		setCollapsedIds((current) => {
			const next = new Set(current)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const header = (
		<>
			<Stack.Screen
				options={{
					title: "Search",
					headerLeft: IS_IOS ? undefined : () => <SidebarToggleButton />,
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
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button
						accessibilityLabel="Open sidebar"
						icon="sidebar.left"
						onPress={openSidebar}
					/>
				</Stack.Toolbar>
			) : null}
		</>
	)

	const chips =
		state.filters.length > 0 ? (
			<FlatList
				contentContainerStyle={styles.chips}
				data={state.filters}
				horizontal
				keyboardShouldPersistTaps="handled"
				keyExtractor={formatFilter}
				renderItem={({ item }) => (
					<FilterChip
						accessibilityLabel={`Remove ${formatFilter(item)} filter`}
						label={formatFilter(item)}
						onRemove={() => removeFilter(item)}
						selected
					/>
				)}
				showsHorizontalScrollIndicator={false}
			/>
		) : null

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
								description="Try another word or remove a filter."
								Icon={Search}
								title={`No results for “${raw}”`}
							/>
						)
					}
					ListHeaderComponent={
						<>
							{chips}
							{activeQuery && results.length > 0 ? (
								<View style={styles.metaRow}>
									<Text style={[styles.meta, { color: colors.secondaryLabel }]}>{meta}</Text>
									<Pressable
										accessibilityRole="button"
										hitSlop={8}
										onPress={() => setCollapsedIds(new Set(results.map((result) => result.id)))}
									>
										<Text style={[styles.metaAction, { color: colors.tint }]}>Collapse all</Text>
									</Pressable>
								</View>
							) : null}
						</>
					}
					renderItem={({ item, index }) => (
						<SearchResultGroup
							active={index === 0}
							collapsed={collapsedIds.has(item.id)}
							colors={colors}
							onOpen={openMatch}
							onToggle={() => toggleCollapsed(item.id)}
							result={item}
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
				chips={chips}
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
	chips: {
		flexDirection: "row",
		gap: 8,
		paddingBottom: 4,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	group: {
		marginBottom: 10,
	},
	groupHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
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
		paddingLeft: IS_IOS ? 42 : 56,
		paddingRight: 16,
		paddingVertical: 10,
	},
	listContent: {
		paddingBottom: IS_IOS ? 140 : 32,
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
		flex: 1,
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: 18,
	},
	metaAction: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "500",
		lineHeight: 20,
	},
	metaRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		marginBottom: 6,
		marginHorizontal: IS_IOS ? 20 : 24,
		marginTop: 12,
	},
})
