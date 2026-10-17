import {
	findThemeFamily,
	formatCount,
	getItemStats,
	groupMarketplaceEntries,
	isVerifiedEntry,
	type MarketplaceEntryGroupKey,
	type MarketplaceSortOrder,
	type MarketplaceTab,
	selectMarketplaceEntries,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import {
	ActivityIndicator,
	Image,
	Platform,
	Pressable,
	RefreshControl,
	SectionList,
	StyleSheet,
	Text,
	View,
} from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import {
	isTemplateInVault,
	listTemplates,
	matchesTemplateKind,
	type TemplateKindFilter,
	templateMeta,
	useMarketplaceExtras,
} from "@/features/marketplace/marketplaceAdapter"
import type { MarketplaceTemplate } from "@/features/marketplace/marketplaceFixtures"
import { openMarketplaceEntry } from "@/features/marketplace/marketplaceNavigation"
import { useThemeFamilies } from "@/features/themes/communityThemes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const ARTWORK_SIZE = 40

type MarketTab = "plugins" | "themes" | "templates"

const TAB_OPTIONS: { label: string; value: MarketTab }[] = [
	{ label: "Plugins", value: "plugins" },
	{ label: "Themes", value: "themes" },
	{ label: "Templates", value: "templates" },
]

const KIND_OPTIONS: { label: string; value: TemplateKindFilter }[] = [
	{ label: "All templates", value: "all" },
	{ label: "Notes", value: "note" },
	{ label: "Databases", value: "database" },
]

const SORT_OPTIONS: { label: string; value: MarketplaceSortOrder }[] = [
	{ label: "Default order", value: "default" },
	{ label: "Most voted", value: "popular" },
	{ label: "Most downloaded", value: "downloads" },
	{ label: "Newest first", value: "newest" },
	{ label: "Oldest first", value: "oldest" },
]

const ENTRY_GROUP_LABELS: Record<MarketplaceEntryGroupKey, string> = {
	updates: "Updates",
	installed: "Installed",
	available: "Discover",
}

const PLUGIN_ICON: SymbolName = { sf: "puzzlepiece.extension", md: "extension" }
const THEME_ICON: SymbolName = { sf: "paintpalette", md: "palette" }
const NOTE_ICON: SymbolName = { sf: "doc.text", md: "description" }
const DATABASE_ICON: SymbolName = { sf: "tablecells", md: "table" }

interface MarketRow {
	key: string
	title: string
	meta: string
	icon: SymbolName
	imageUrl?: string
	status?: string
	statusTint?: boolean
	onPress: () => void
}

interface MarketSection {
	key: string
	label: string
	data: MarketRow[]
}

function isMarketTab(value: string | undefined): value is MarketTab {
	return value === "plugins" || value === "themes" || value === "templates"
}

function matchesQuery(query: string, ...values: string[]): boolean {
	const normalized = query.trim().toLowerCase()
	return !normalized || values.some((value) => value.toLowerCase().includes(normalized))
}

function Artwork({ icon, imageUrl }: { icon: SymbolName; imageUrl?: string }) {
	const { colors } = useMobileColors()
	const [failed, setFailed] = useState(false)
	return (
		<View style={[styles.artwork, { backgroundColor: colors.accentSubtle }]}>
			{imageUrl && !failed ? (
				<Image
					onError={() => setFailed(true)}
					resizeMode="cover"
					source={{ height: ARTWORK_SIZE, uri: imageUrl, width: ARTWORK_SIZE }}
					style={styles.artworkImage}
				/>
			) : (
				<SymbolIcon color={colors.tint} name={icon} size={22} />
			)}
		</View>
	)
}

function Row({ first, last, row }: { first: boolean; last: boolean; row: MarketRow }) {
	const { colors } = useMobileColors()
	return (
		<View
			style={[
				styles.cell,
				{ backgroundColor: colors.cell },
				first ? styles.cellFirst : null,
				last ? styles.cellLast : null,
				!IS_IOS && !last ? styles.m3Gap : null,
			]}
		>
			<Pressable
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				onPress={row.onPress}
				style={({ pressed }) => [
					styles.row,
					{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
				]}
			>
				<Artwork icon={row.icon} imageUrl={row.imageUrl} />
				<View style={styles.rowBody}>
					<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
						{row.title}
					</Text>
					<Text numberOfLines={1} style={[styles.meta, { color: colors.secondaryLabel }]}>
						{row.meta}
					</Text>
				</View>
				{row.status ? (
					<Text
						style={[styles.status, { color: row.statusTint ? colors.tint : colors.secondaryLabel }]}
					>
						{row.status}
					</Text>
				) : null}
				{IS_IOS ? (
					<SymbolIcon
						color={colors.tertiaryLabel}
						name={{ sf: "chevron.right", md: "chevron_right" }}
						size={13}
					/>
				) : null}
			</Pressable>
			{IS_IOS && !last ? (
				<View style={[styles.separator, { backgroundColor: colors.separator }]} />
			) : null}
		</View>
	)
}

function MarketplaceMenu({ groups }: { groups: MenuGroup[] }) {
	if (!IS_IOS) {
		return (
			<Stack.Screen
				options={{
					headerRight: () => (
						<NativeMenu
							accessibilityLabel="Filter and sort"
							groups={groups}
							icon={{ sf: "line.3.horizontal.decrease.circle", md: "filter_list" }}
						/>
					),
				}}
			/>
		)
	}
	return (
		<Stack.Toolbar placement="right">
			<Stack.Toolbar.Menu
				accessibilityLabel="Filter and sort"
				icon="line.3.horizontal.decrease.circle"
				title="Filter and sort"
			>
				{groups.map((group) => (
					<Stack.Toolbar.Menu inline key={group[0]?.key ?? "group"}>
						{group.map((item) => (
							<Stack.Toolbar.MenuAction
								icon={item.icon?.sf}
								isOn={item.checked}
								key={item.key}
								onPress={item.onPress}
							>
								{item.label}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				))}
			</Stack.Toolbar.Menu>
		</Stack.Toolbar>
	)
}

export function MarketplaceScreen() {
	const params = useLocalSearchParams<{ tab?: string }>()
	const { colors } = useMobileColors()
	const [tab, setTab] = useState<MarketTab>(isMarketTab(params.tab) ? params.tab : "plugins")
	const [query, setQuery] = useState("")
	const [kind, setKind] = useState<TemplateKindFilter>("all")
	const [registryLoaded, setRegistryLoaded] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const plugins = usePluginStore((state) => state.plugins)
	const families = useThemeFamilies()
	const selectedTheme = useSettingsStore((state) => state.settings.appearance.theme)
	const pluginEntries = useMarketplaceStore((state) => state.pluginEntries)
	const themeEntries = useMarketplaceStore((state) => state.themeEntries)
	const filterInstalled = useMarketplaceStore((state) => state.filterInstalled)
	const sortOrder = useMarketplaceStore((state) => state.sortOrder)
	const releaseDates = useMarketplaceStore((state) => state.releaseDates)
	const stats = useMarketplaceStore((state) => state.stats)
	const verified = useMarketplaceStore((state) => state.verified)
	const blocked = useMarketplaceStore((state) => state.blocked)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const registryError = useMarketplaceStore((state) => state.registryError)
	const setActiveTab = useMarketplaceStore((state) => state.setActiveTab)
	const setFilterInstalled = useMarketplaceStore((state) => state.setFilterInstalled)
	const setSortOrder = useMarketplaceStore((state) => state.setSortOrder)
	const loadRegistry = useMarketplaceStore((state) => state.loadRegistry)
	const refreshRegistry = useMarketplaceStore((state) => state.refreshRegistry)
	const extras = useMarketplaceExtras()

	useEffect(() => {
		let cancelled = false
		setActiveTab("plugins")
		void loadRegistry().finally(() => {
			if (!cancelled) setRegistryLoaded(true)
		})
		return () => {
			cancelled = true
		}
	}, [loadRegistry, setActiveTab])

	const handleRefresh = () => {
		setRefreshing(true)
		void refreshRegistry().finally(() => setRefreshing(false))
	}

	const entrySections = (activeTab: MarketplaceTab): MarketSection[] => {
		const themeFamilyByEntry = new Map(
			themeEntries.map((entry) => [entry.id, findThemeFamily(entry, families)?.name]),
		)
		const isInstalled = (entryId: string) =>
			activeTab === "plugins" ? entryId in plugins : Boolean(themeFamilyByEntry.get(entryId))
		const entries = selectMarketplaceEntries(
			{
				activeTab,
				pluginEntries,
				themeEntries,
				searchQuery: query,
				filterInstalled,
				sortOrder,
				releaseDates,
				stats,
				blocked,
			},
			{ isInstalled },
		)
		return groupMarketplaceEntries(entries, { isInstalled, availableUpdates }).map((group) => ({
			key: group.key,
			label: ENTRY_GROUP_LABELS[group.key],
			data: group.entries.map((entry): MarketRow => {
				const version = activeTab === "plugins" ? plugins[entry.id]?.manifest.version : undefined
				const inUse = activeTab === "themes" && themeFamilyByEntry.get(entry.id) === selectedTheme
				const itemStats = getItemStats(stats, activeTab, entry.id)
				const metaParts = [entry.author]
				if (version) metaParts.push(version)
				if (isVerifiedEntry(verified, activeTab, entry.id)) metaParts.push("Verified")
				if (itemStats)
					metaParts.push(
						`${formatCount(itemStats.votes)} ▲`,
						`${formatCount(itemStats.downloads)} ↓`,
					)
				return {
					key: entry.id,
					title: entry.name,
					meta: metaParts.join(" · "),
					icon: activeTab === "plugins" ? PLUGIN_ICON : THEME_ICON,
					imageUrl: entry.coverImageUrl,
					status:
						group.key === "updates"
							? "Update"
							: inUse
								? "In use"
								: group.key === "installed"
									? "Installed"
									: undefined,
					statusTint: group.key === "updates" || inUse,
					onPress: () =>
						openMarketplaceEntry(entry.id, activeTab === "plugins" ? "plugin" : "theme"),
				}
			}),
		}))
	}

	const templateRow = (template: MarketplaceTemplate): MarketRow => ({
		key: template.id,
		title: template.name,
		meta: templateMeta(template),
		icon: template.isDatabase ? DATABASE_ICON : NOTE_ICON,
		status: template.group !== "team" && isTemplateInVault(extras, template) ? "Added" : undefined,
		onPress: () => openMarketplaceEntry(template.id, "template"),
	})

	const templateSections = (): MarketSection[] => {
		const templates = listTemplates().filter(
			(template) =>
				matchesTemplateKind(template, kind) && matchesQuery(query, template.name, template.author),
		)
		return [
			{
				key: "team",
				label: "From your team",
				data: templates.filter((template) => template.group === "team").map(templateRow),
			},
			{
				key: "vault",
				label: "In this vault",
				data: templates
					.filter((template) => template.group !== "team" && isTemplateInVault(extras, template))
					.map(templateRow),
			},
			{
				key: "market",
				label: "Marketplace",
				data: templates
					.filter((template) => template.group === "market" && !isTemplateInVault(extras, template))
					.map(templateRow),
			},
		].filter((section) => section.data.length > 0)
	}

	const sections = tab === "templates" ? templateSections() : entrySections(tab)

	const menuGroups: MenuGroup[] =
		tab !== "templates"
			? [
					[
						{
							key: "installed-only",
							label: "Installed only",
							checked: filterInstalled,
							onPress: () => setFilterInstalled(!filterInstalled),
						},
					],
					SORT_OPTIONS.map((option) => ({
						key: `sort-${option.value}`,
						label: option.label,
						checked: sortOrder === option.value,
						onPress: () => setSortOrder(option.value),
					})),
				]
			: [
					KIND_OPTIONS.map((option) => ({
						key: `kind-${option.value}`,
						label: option.label,
						checked: kind === option.value,
						onPress: () => setKind(option.value),
					})),
				]

	const usesRegistry = tab !== "templates"
	const loading = usesRegistry && !registryLoaded

	return (
		<>
			<Stack.SearchBar
				autoCapitalize="none"
				hideWhenScrolling={false}
				onCancelButtonPress={() => setQuery("")}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder={`Search ${tab}`}
			/>
			<MarketplaceMenu groups={menuGroups} />
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyExtractor={(row) => row.key}
				ListEmptyComponent={
					loading ? (
						<ActivityIndicator color={colors.tint} style={styles.loading} />
					) : (
						<EmptyState
							description={usesRegistry && registryError ? "Pull down to try again." : undefined}
							icon={{ sf: "magnifyingglass", md: "search" }}
							title={usesRegistry && registryError ? `Unable to load ${tab}` : "No results"}
						/>
					)
				}
				ListHeaderComponent={
					<SegmentedControl
						accessibilityLabel="Marketplace sections"
						onChange={setTab}
						options={TAB_OPTIONS}
						style={styles.segmented}
						value={tab}
					/>
				}
				refreshControl={
					usesRegistry ? (
						<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />
					) : undefined
				}
				renderItem={({ index, item, section }) => (
					<Row first={index === 0} last={index === section.data.length - 1} row={item} />
				)}
				renderSectionHeader={({ section }) => (
					<GroupedSectionHeader>
						{IS_IOS ? section.label.toUpperCase() : section.label}
					</GroupedSectionHeader>
				)}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	artwork: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 10,
		height: ARTWORK_SIZE,
		justifyContent: "center",
		overflow: "hidden",
		width: ARTWORK_SIZE,
	},
	artworkImage: {
		height: ARTWORK_SIZE,
		width: ARTWORK_SIZE,
	},
	cell: {
		borderCurve: "continuous",
		marginHorizontal: 16,
		overflow: "hidden",
	},
	cellFirst: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	cellLast: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	content: {
		paddingBottom: 40,
	},
	loading: {
		marginTop: 32,
	},
	m3Gap: {
		marginBottom: 2,
	},
	meta: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: 18,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 60,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	rowBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	segmented: {
		marginHorizontal: 16,
		marginTop: 8,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 68,
	},
	status: {
		fontSize: 15,
		lineHeight: 20,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
})
