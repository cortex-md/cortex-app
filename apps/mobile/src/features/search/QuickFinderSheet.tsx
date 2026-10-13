import {
	formatRelativeTime,
	getErrorMessage,
	joinPath,
	selectSortedTags,
	useBookmarksStore,
	useTagsStore,
	useVaultStore,
} from "@cortex/core"
import { type Href, router, useLocalSearchParams } from "expo-router"
import {
	ArrowLeft,
	Check,
	ChevronRight,
	Eye,
	EyeOff,
	FileSearch,
	Plus,
	Search,
	Square,
	SquareCheck,
	Terminal,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import {
	ActivityIndicator,
	FlatList,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { FilterChip } from "@/components/ui/FilterChip"
import { GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openNote } from "@/features/navigation/routes"
import { QuickFinderPreview } from "@/features/search/QuickFinderPreview"
import { HighlightedTitle, SearchSnippetText } from "@/features/search/SearchSnippetText"
import {
	type QuickFinderItem,
	type QuickFinderSort,
	useQuickFinderResults,
} from "@/features/search/useQuickFinderResults"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"
const EMPTY_TAGS: string[] = []

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

function InlineMenu({
	children,
	colors,
	trailing = false,
}: {
	children: React.ReactNode
	colors: MobileColors
	trailing?: boolean
}) {
	return (
		<View
			style={[
				styles.menu,
				trailing ? styles.menuTrailing : null,
				{
					backgroundColor: IS_IOS ? colors.glass : colors.menuBackground,
					borderColor: IS_IOS ? colors.glassEdge : colors.menuBorder,
				},
			]}
		>
			{children}
		</View>
	)
}

function MenuRow({
	checked,
	colors,
	detail,
	label,
	multi = false,
	onPress,
}: {
	checked: boolean
	colors: MobileColors
	detail?: string
	label: string
	multi?: boolean
	onPress: () => void
}) {
	const CheckboxIcon = checked ? SquareCheck : Square
	return (
		<Pressable
			accessibilityRole={multi ? "checkbox" : "radio"}
			accessibilityState={{ checked }}
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.menuRow,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
			]}
		>
			{!IS_IOS && multi ? (
				<CheckboxIcon color={checked ? colors.tint : colors.secondaryLabel} size={22} />
			) : null}
			<Text numberOfLines={1} style={[styles.menuLabel, { color: colors.label }]}>
				{label}
			</Text>
			{detail ? (
				<Text style={[styles.menuDetail, { color: colors.secondaryLabel }]}>{detail}</Text>
			) : null}
			{checked && (IS_IOS || !multi) ? (
				<Check color={colors.tint} size={20} strokeWidth={2.4} />
			) : null}
		</Pressable>
	)
}

function ResultRow({
	colors,
	item,
	onPress,
	query,
	selected,
}: {
	colors: MobileColors
	item: QuickFinderItem
	onPress: () => void
	query: string
	selected: boolean
}) {
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.resultRow,
				{
					backgroundColor: selected
						? colors.accentSubtle
						: pressed && IS_IOS
							? colors.hover
							: "transparent",
				},
			]}
		>
			<View style={styles.resultBody}>
				<Text numberOfLines={1} style={[styles.resultDir, { color: colors.secondaryLabel }]}>
					{item.folder ? `${item.folder}/` : "/"}
				</Text>
				<HighlightedTitle query={query} title={item.title} />
				{item.snippet ? (
					<SearchSnippetText numberOfLines={1} snippet={item.snippet} style={styles.resultSnippet} />
				) : null}
			</View>
			{item.modifiedAt ? (
				<Text style={[styles.resultWhen, { color: colors.secondaryLabel }]}>
					{formatRelativeTime(item.modifiedAt, "short")}
				</Text>
			) : null}
		</Pressable>
	)
}

export function QuickFinderSheet() {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams<QuickFinderParams>()
	const vault = useVaultStore((state) => state.vault)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const [query, setQuery] = useState(() => params.query ?? "")
	const [folder, setFolder] = useState<string | null>(() => params.folder || null)
	const [selectedTags, setSelectedTags] = useState<string[]>(EMPTY_TAGS)
	const [titleOnly, setTitleOnly] = useState(false)
	const [sort, setSort] = useState<QuickFinderSort>("best")
	const [preview, setPreview] = useState(false)
	const [openMenu, setOpenMenu] = useState<"tag" | "sort" | null>(null)
	const [tagQuery, setTagQuery] = useState("")
	useEnsureVaultIndexed()

	const filters = useMemo(
		() => ({ folder, tags: selectedTags, titleOnly, sort }),
		[folder, selectedTags, sort, titleOnly],
	)
	const { items, pending } = useQuickFinderResults(query, filters)
	const allTags = useMemo(() => selectSortedTags({ tagIndex, tagColors }), [tagColors, tagIndex])
	const visibleTags = allTags.filter((entry) =>
		entry.tag.toLowerCase().includes(tagQuery.trim().toLowerCase()),
	)
	const trimmedQuery = query.trim()
	const relinkBookmark = params.relinkBookmark

	const handleQueryChange = (text: string) => {
		if (text.startsWith(">")) {
			router.replace({ pathname: "/command-palette" } as Href)
			return
		}
		setQuery(text)
	}

	const handleOpen = (item: QuickFinderItem) => {
		if (relinkBookmark && vault) {
			void useBookmarksStore
				.getState()
				.renameBookmarkPath(vault.path, relinkBookmark, item.filePath)
				.then(() => toast("Bookmark updated"))
				.catch((error: unknown) => toast(getErrorMessage(error)))
			dismissSheet()
			return
		}
		dismissSheet()
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

	const toggleTag = (tag: string) => {
		setSelectedTags((current) =>
			current.includes(tag) ? current.filter((candidate) => candidate !== tag) : [...current, tag],
		)
	}

	const tagLabel = selectedTags.length > 0 ? `Tag · ${selectedTags.length}` : "Tag"
	const groupLabel = trimmedQuery
		? `${items.length} ${items.length === 1 ? "note" : "notes"}${folder ? ` in ${folder}` : ""}`
		: "Recent"
	const PreviewIcon = preview ? EyeOff : Eye
	const selectedItem = items[0] ?? null

	const inputField = (
		<View style={[styles.field, { backgroundColor: colors.fill }]}>
			{IS_IOS ? <FileSearch color={colors.secondaryLabel} size={18} strokeWidth={2.2} /> : null}
			<TextInput
				accessibilityLabel="Find or create a note"
				autoCapitalize="none"
				autoCorrect={false}
				autoFocus
				onChangeText={handleQueryChange}
				onSubmitEditing={() => {
					if (selectedItem) handleOpen(selectedItem)
					else if (trimmedQuery) void handleCreate()
				}}
				placeholder="Find or create a note…"
				placeholderTextColor={colors.secondaryLabel}
				returnKeyType="go"
				style={[styles.input, { color: colors.label }]}
				value={query}
			/>
		</View>
	)

	const previewButton = (
		<Pressable
			accessibilityLabel="Show preview"
			accessibilityRole="button"
			accessibilityState={{ selected: preview }}
			android_ripple={{ borderless: true, color: colors.hover }}
			onPress={() => setPreview((current) => !current)}
			style={({ pressed }) => [
				styles.squareButton,
				IS_IOS ? { backgroundColor: preview ? colors.accentSubtle : colors.fill } : null,
				{ opacity: pressed ? 0.6 : 1 },
			]}
		>
			<PreviewIcon color={preview ? colors.tint : colors.secondaryLabel} size={IS_IOS ? 20 : 24} />
		</Pressable>
	)

	return (
		<View style={[styles.root, { backgroundColor: IS_IOS ? colors.groupedBackground : colors.background }]}>
			{IS_IOS ? (
				<>
					<SheetHeader onClose={dismissSheet} title="Quick finder" />
					<View style={styles.fieldRow}>
						{inputField}
						{previewButton}
					</View>
				</>
			) : (
				<View style={[styles.androidTop, { paddingTop: insets.top + 4 }]}>
					<Pressable
						accessibilityLabel="Close"
						accessibilityRole="button"
						android_ripple={{ borderless: true, color: colors.hover }}
						onPress={dismissSheet}
						style={styles.squareButton}
					>
						<ArrowLeft color={colors.label} size={24} />
					</Pressable>
					{inputField}
					{previewButton}
				</View>
			)}
			<ScrollView
				contentContainerStyle={styles.chips}
				horizontal
				keyboardShouldPersistTaps="handled"
				showsHorizontalScrollIndicator={false}
				style={styles.chipsBar}
			>
				{folder ? (
					<FilterChip
						accessibilityLabel="Remove folder filter"
						label={`Folder: ${folder}`}
						onRemove={() => setFolder(null)}
						selected
					/>
				) : null}
				<FilterChip
					accessibilityLabel="Filter by tag"
					label={tagLabel}
					menu
					onPress={() => setOpenMenu((current) => (current === "tag" ? null : "tag"))}
					selected={selectedTags.length > 0}
				/>
				<FilterChip
					label="Title only"
					onPress={() => setTitleOnly((current) => !current)}
					selected={titleOnly}
				/>
				<FilterChip
					accessibilityLabel="Sort"
					label={sortLabels[sort]}
					menu
					onPress={() => setOpenMenu((current) => (current === "sort" ? null : "sort"))}
				/>
			</ScrollView>
			{openMenu === "tag" ? (
				<InlineMenu colors={colors}>
					<View style={[styles.tagSearch, { backgroundColor: colors.fill }]}>
						<Search color={colors.secondaryLabel} size={16} strokeWidth={2.2} />
						<TextInput
							accessibilityLabel="Find a tag"
							autoCapitalize="none"
							autoCorrect={false}
							onChangeText={setTagQuery}
							placeholder="Find a tag"
							placeholderTextColor={colors.secondaryLabel}
							style={[styles.tagSearchInput, { color: colors.label }]}
							value={tagQuery}
						/>
					</View>
					<ScrollView keyboardShouldPersistTaps="handled" style={styles.menuList}>
						{visibleTags.length === 0 ? (
							<Text style={[styles.menuEmpty, { color: colors.secondaryLabel }]}>No tags</Text>
						) : (
							visibleTags.map((entry) => (
								<MenuRow
									checked={selectedTags.includes(entry.tag)}
									colors={colors}
									detail={String(entry.filePaths.length)}
									key={entry.tag}
									label={`#${entry.tag}`}
									multi
									onPress={() => toggleTag(entry.tag)}
								/>
							))
						)}
					</ScrollView>
				</InlineMenu>
			) : null}
			{openMenu === "sort" ? (
				<InlineMenu colors={colors} trailing>
					{sortOrders.map((order) => (
						<MenuRow
							checked={sort === order}
							colors={colors}
							key={order}
							label={sortLabels[order]}
							onPress={() => {
								setSort(order)
								setOpenMenu(null)
							}}
						/>
					))}
				</InlineMenu>
			) : null}
			<FlatList
				contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
				data={items}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(item) => item.id}
				ListEmptyComponent={
					pending ? (
						<View style={styles.loading}>
							<ActivityIndicator color={colors.tint} />
						</View>
					) : (
						<Text style={[styles.empty, { color: colors.secondaryLabel }]}>
							{trimmedQuery ? "No matching notes" : "No recent notes"}
						</Text>
					)
				}
				ListFooterComponent={
					<>
						{preview && selectedItem ? <QuickFinderPreview item={selectedItem} /> : null}
						<View style={styles.footer}>
							<GroupedList>
								{trimmedQuery && !relinkBookmark ? (
									<GroupedRow
										leading={
											<View style={[styles.createIcon, { backgroundColor: colors.accentSubtle }]}>
												<Plus color={colors.tint} size={18} strokeWidth={2.4} />
											</View>
										}
										onPress={() => void handleCreate()}
										tint
										title={`Create “${trimmedQuery}”`}
									/>
								) : null}
								<GroupedRow
									leading={
										<View style={[styles.createIcon, { backgroundColor: colors.fill }]}>
											<Terminal color={colors.secondaryLabel} size={18} strokeWidth={2.2} />
										</View>
									}
									onPress={() => router.replace({ pathname: "/command-palette" } as Href)}
									subtitle="Type > to run a command"
									title="Commands"
									trailing={<ChevronRight color={colors.tertiaryLabel} size={IS_IOS ? 14 : 24} />}
								/>
							</GroupedList>
						</View>
					</>
				}
				ListHeaderComponent={<GroupedSectionHeader>{groupLabel}</GroupedSectionHeader>}
				renderItem={({ item, index }) => (
					<View style={[styles.resultCard, { backgroundColor: colors.cell }, index === 0 ? styles.firstCard : null, index === items.length - 1 ? styles.lastCard : null]}>
						<ResultRow
							colors={colors}
							item={item}
							onPress={() => handleOpen(item)}
							query={trimmedQuery}
							selected={index === 0 && Boolean(trimmedQuery)}
						/>
						{IS_IOS && index < items.length - 1 ? (
							<View style={[styles.separator, { backgroundColor: colors.separator }]} />
						) : null}
					</View>
				)}
				style={styles.list}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	androidTop: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	chips: {
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 6,
	},
	chipsBar: {
		flexGrow: 0,
	},
	createIcon: {
		alignItems: "center",
		borderRadius: 8,
		height: 30,
		justifyContent: "center",
		width: 30,
	},
	empty: {
		fontSize: 15,
		lineHeight: 20,
		paddingHorizontal: 32,
		paddingVertical: 24,
		textAlign: "center",
	},
	field: {
		alignItems: "center",
		borderRadius: IS_IOS ? 999 : 28,
		flex: 1,
		flexDirection: "row",
		gap: 8,
		height: IS_IOS ? 44 : 52,
		paddingHorizontal: 14,
	},
	fieldRow: {
		flexDirection: "row",
		gap: 8,
		paddingBottom: 4,
		paddingHorizontal: 16,
	},
	firstCard: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	footer: {
		marginTop: 12,
	},
	input: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
		minWidth: 0,
		padding: 0,
	},
	lastCard: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	list: {
		flex: 1,
	},
	listContent: {
		paddingTop: 4,
	},
	loading: {
		paddingVertical: 24,
	},
	menu: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 22 : 4,
		borderWidth: StyleSheet.hairlineWidth,
		marginHorizontal: 16,
		marginTop: 4,
		overflow: "hidden",
		paddingVertical: 4,
	},
	menuDetail: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
	},
	menuEmpty: {
		fontSize: 14,
		lineHeight: 20,
		padding: 12,
	},
	menuLabel: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
	menuList: {
		maxHeight: 240,
	},
	menuRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 44,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	menuTrailing: {
		alignSelf: "flex-end",
		width: 220,
	},
	resultBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	resultCard: {
		marginHorizontal: 16,
		overflow: "hidden",
	},
	resultDir: {
		fontSize: 13,
		lineHeight: 18,
	},
	resultRow: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 12,
		minHeight: 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	resultSnippet: {
		fontSize: 13,
		lineHeight: 18,
	},
	resultWhen: {
		fontSize: 13,
		lineHeight: 18,
		paddingTop: 20,
	},
	root: {
		flex: 1,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 16,
	},
	squareButton: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 44 : 48,
		justifyContent: "center",
		width: IS_IOS ? 44 : 48,
	},
	tagSearch: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: 8,
		height: 36,
		marginHorizontal: 12,
		marginVertical: 8,
		paddingHorizontal: 12,
	},
	tagSearchInput: {
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
		minWidth: 0,
		padding: 0,
	},
})
