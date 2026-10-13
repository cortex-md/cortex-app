import {
	groupMarketplaceEntries,
	type MarketplaceEntryGroupKey,
	type RegistryEntry,
	selectMarketplaceEntries,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { usePluginStore } from "@cortex/plugin-host-core"
import type { ButtonVariant } from "@expo/ui"
import { Stack } from "expo-router"
import { FileText, Palette, RefreshCw, Table2 } from "lucide-react-native"
import { type ReactNode, useEffect, useState } from "react"
import {
	ActivityIndicator,
	Image,
	Platform,
	Pressable,
	SectionList,
	StyleSheet,
	Text,
	View,
} from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { FilterChip } from "@/components/ui/FilterChip"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { SearchField } from "@/components/ui/SearchField"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { toast } from "@/features/feedback/useToast"
import {
	addTemplate,
	applyTheme,
	installTheme,
	isTemplateInVault,
	isThemeInstalled,
	listTemplates,
	listThemes,
	matchesTemplateKind,
	openTemplate,
	type TemplateKindFilter,
	templateMeta,
	useMarketplaceExtras,
} from "@/features/marketplace/marketplaceAdapter"
import type { MarketplaceTemplate, MarketplaceTheme } from "@/features/marketplace/marketplaceFixtures"
import { openMarketplaceEntry } from "@/features/marketplace/marketplaceNavigation"
import { openSettings } from "@/features/navigation/routes"
import {
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import { ActionButton } from "@/features/sync/SettingsPage"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const ICON_SIZE = 40

type MarketTab = "plugins" | "themes" | "templates"

const TAB_OPTIONS: { label: string; value: MarketTab }[] = [
	{ label: "Plugins", value: "plugins" },
	{ label: "Themes", value: "themes" },
	{ label: "Templates", value: "templates" },
]

const KIND_OPTIONS: { label: string; value: TemplateKindFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Notes", value: "note" },
	{ label: "Databases", value: "database" },
]

const PLUGIN_GROUP_LABELS: Record<MarketplaceEntryGroupKey, string> = {
	updates: "Updates",
	installed: "Installed",
	available: "Discover · Curated",
}

interface RowCta {
	label: string
	variant: ButtonVariant
	disabled?: boolean
	onPress: () => void
}

interface MarketRow {
	key: string
	title: string
	meta: string
	icon: ReactNode
	cta: RowCta
	onPress: () => void
}

interface MarketSection {
	key: string
	label: string
	team: boolean
	data: MarketRow[]
}

function IconTile({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return <View style={[styles.icon, { backgroundColor: colors.accentSubtle }]}>{children}</View>
}

function PluginArtwork({ entry }: { entry: RegistryEntry }) {
	const { colors } = useMobileColors()
	if (entry.coverImageUrl) {
		return <Image source={{ uri: entry.coverImageUrl }} style={[styles.icon, { backgroundColor: colors.fill }]} />
	}
	return (
		<View style={[styles.icon, { backgroundColor: colors.fill }]}>
			<Text style={[styles.initial, { color: colors.secondaryLabel }]}>
				{entry.name.charAt(0).toUpperCase()}
			</Text>
		</View>
	)
}

function matchesQuery(query: string, ...values: string[]): boolean {
	const normalized = query.trim().toLowerCase()
	return !normalized || values.some((value) => value.toLowerCase().includes(normalized))
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
				{row.icon}
				<View style={styles.rowBody}>
					<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
						{row.title}
					</Text>
					<Text numberOfLines={1} style={[styles.meta, { color: colors.secondaryLabel }]}>
						{row.meta}
					</Text>
				</View>
				<ActionButton
					disabled={row.cta.disabled}
					label={row.cta.label}
					onPress={row.cta.onPress}
					variant={row.cta.variant}
				/>
			</Pressable>
			{IS_IOS && !last ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}
		</View>
	)
}

export function MarketplaceScreen() {
	const { colors, themeName } = useMobileColors()
	const [tab, setTab] = useState<MarketTab>("plugins")
	const [query, setQuery] = useState("")
	const [kind, setKind] = useState<TemplateKindFilter>("all")
	const [registryLoaded, setRegistryLoaded] = useState(false)
	const plugins = usePluginStore((state) => state.plugins)
	const pluginEntries = useMarketplaceStore((state) => state.pluginEntries)
	const themeEntries = useMarketplaceStore((state) => state.themeEntries)
	const filterInstalled = useMarketplaceStore((state) => state.filterInstalled)
	const sortOrder = useMarketplaceStore((state) => state.sortOrder)
	const releaseDates = useMarketplaceStore((state) => state.releaseDates)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const registryError = useMarketplaceStore((state) => state.registryError)
	const loadingEntryId = useMarketplaceStore((state) => state.loadingEntryId)
	const setActiveTab = useMarketplaceStore((state) => state.setActiveTab)
	const loadRegistry = useMarketplaceStore((state) => state.loadRegistry)
	const refreshRegistry = useMarketplaceStore((state) => state.refreshRegistry)
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const allowCommunity = useCommunityPluginsAllowed()
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

	const updateCount = Object.keys(availableUpdates).filter((id) => id in plugins).length
	const subtitle = updateCount > 0 ? `${updateCount} ${updateCount === 1 ? "update" : "updates"}` : "Up to date"

	const handleRefresh = () => {
		void refreshRegistry().then(() => toast("Marketplace refreshed"))
	}

	const pluginSections = (): MarketSection[] => {
		const isInstalled = (entryId: string) => entryId in plugins
		const entries = selectMarketplaceEntries(
			{
				activeTab: "plugins",
				pluginEntries,
				themeEntries,
				searchQuery: query,
				filterInstalled,
				sortOrder,
				releaseDates,
			},
			{ isInstalled },
		)
		return groupMarketplaceEntries(entries, { isInstalled, availableUpdates }).map((group) => ({
			key: group.key,
			label: PLUGIN_GROUP_LABELS[group.key],
			team: false,
			data: group.entries.map((entry): MarketRow => {
				const busy = loadingEntryId === entry.id
				const version = plugins[entry.id]?.manifest.version
				const cta: RowCta =
					group.key === "updates"
						? { label: "Update", variant: "filled", disabled: busy, onPress: () => void installEntry(entry) }
						: group.key === "installed"
							? { label: "Open", variant: "text", onPress: () => openSettings("plugins") }
							: {
									label: "Install",
									variant: "outlined",
									disabled: busy,
									onPress: () =>
										allowCommunity
											? void installEntry(entry)
											: void setCommunityPluginsAllowed(true),
								}
				return {
					key: entry.id,
					title: entry.name,
					meta: version ? `${entry.author} · ${version}` : entry.author,
					icon: <PluginArtwork entry={entry} />,
					cta,
					onPress: () => openMarketplaceEntry(entry.id, "plugin"),
				}
			}),
		}))
	}

	const themeRow = (theme: MarketplaceTheme): MarketRow => {
		const installed = isThemeInstalled(extras, theme)
		const inUse = theme.builtIn && theme.id === themeName
		return {
			key: theme.id,
			title: theme.name,
			meta: theme.meta,
			icon: (
				<IconTile>
					<Palette color={colors.tint} size={22} strokeWidth={2} />
				</IconTile>
			),
			cta: inUse
				? { label: "In use", variant: "text", disabled: true, onPress: () => {} }
				: installed
					? { label: "Use", variant: "outlined", onPress: () => applyTheme(theme) }
					: { label: "Install", variant: "outlined", onPress: () => installTheme(theme) },
			onPress: () => openMarketplaceEntry(theme.id, "theme"),
		}
	}

	const themeSections = (): MarketSection[] => {
		const themes = listThemes().filter((theme) => matchesQuery(query, theme.name, theme.author))
		const installed = themes.filter((theme) => isThemeInstalled(extras, theme))
		const discover = themes.filter((theme) => !isThemeInstalled(extras, theme))
		return [
			{ key: "installed", label: "Installed", team: false, data: installed.map(themeRow) },
			{ key: "discover", label: "Discover · Curated", team: false, data: discover.map(themeRow) },
		].filter((section) => section.data.length > 0)
	}

	const templateRow = (template: MarketplaceTemplate): MarketRow => {
		const inVault = isTemplateInVault(extras, template)
		const isDatabase = template.isDatabase
		const cta: RowCta =
			template.group === "team"
				? { label: "Use", variant: "outlined", onPress: () => openTemplate(template) }
				: inVault
					? { label: "Open", variant: "text", onPress: () => openTemplate(template) }
					: { label: "Add", variant: "outlined", onPress: () => addTemplate(template) }
		return {
			key: template.id,
			title: template.name,
			meta: templateMeta(template),
			icon: (
				<IconTile>
					{isDatabase ? (
						<Table2 color={colors.tint} size={22} strokeWidth={2} />
					) : (
						<FileText color={colors.tint} size={22} strokeWidth={2} />
					)}
				</IconTile>
			),
			cta,
			onPress: () => openMarketplaceEntry(template.id, "template"),
		}
	}

	const templateSections = (): MarketSection[] => {
		const templates = listTemplates().filter(
			(template) =>
				matchesTemplateKind(template, kind) && matchesQuery(query, template.name, template.author),
		)
		return [
			{
				key: "team",
				label: "From your team · Design",
				team: true,
				data: templates.filter((template) => template.group === "team").map(templateRow),
			},
			{
				key: "vault",
				label: "In this vault",
				team: false,
				data: templates
					.filter((template) => template.group !== "team" && isTemplateInVault(extras, template))
					.map(templateRow),
			},
			{
				key: "market",
				label: "Marketplace",
				team: false,
				data: templates
					.filter((template) => template.group === "market" && !isTemplateInVault(extras, template))
					.map(templateRow),
			},
		].filter((section) => section.data.length > 0)
	}

	const sections =
		tab === "plugins" ? pluginSections() : tab === "themes" ? themeSections() : templateSections()

	const emptyMessage =
		tab === "plugins" && registryError
			? "Unable to load the plugin registry. Tap refresh to retry."
			: "Nothing matches your search."

	return (
		<>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						accessibilityLabel="Refresh marketplace"
						icon="arrow.clockwise"
						onPress={handleRefresh}
					/>
				</Stack.Toolbar>
			) : (
				<Stack.Screen
					options={{
						headerRight: () => (
							<HeaderIconButton
								accessibilityLabel="Refresh marketplace"
								Icon={RefreshCw}
								onPress={handleRefresh}
							/>
						),
					}}
				/>
			)}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyExtractor={(row) => row.key}
				ListEmptyComponent={
					tab === "plugins" && !registryLoaded ? (
						<ActivityIndicator color={colors.tint} style={styles.loading} />
					) : (
						<Text style={[styles.empty, { color: colors.secondaryLabel }]}>{emptyMessage}</Text>
					)
				}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.subtitle, { color: colors.tint }]}>{subtitle}</Text>
						<SegmentedControl
							accessibilityLabel="Marketplace sections"
							onChange={(value) => {
								setTab(value)
								setQuery("")
							}}
							options={TAB_OPTIONS}
							value={tab}
						/>
						<View style={styles.search}>
							<SearchField
								onChangeText={setQuery}
								onClear={() => setQuery("")}
								placeholder={tab === "templates" ? "Search templates" : "Search plugins and themes"}
								value={query}
							/>
						</View>
						{tab === "templates" ? (
							<View style={styles.chips}>
								{KIND_OPTIONS.map((option) => (
									<FilterChip
										key={option.value}
										label={option.label}
										onPress={() => setKind(option.value)}
										selected={kind === option.value}
									/>
								))}
							</View>
						) : null}
						{tab === "plugins" && !allowCommunity ? (
							<Pressable accessibilityRole="button" onPress={() => void setCommunityPluginsAllowed(true)}>
								<Text style={[styles.notice, { color: colors.secondaryLabel }]}>
									Community plugins are turned off.{" "}
									<Text style={{ color: colors.tint }}>Turn on to install</Text>
								</Text>
							</Pressable>
						) : null}
					</View>
				}
				renderItem={({ index, item, section }) => (
					<Row first={index === 0} last={index === section.data.length - 1} row={item} />
				)}
				renderSectionHeader={({ section }) => (
					<GroupedSectionHeader trailing={section.team ? <Avatar name="Design" size={22} /> : undefined}>
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
	chips: {
		flexDirection: "row",
		gap: 8,
	},
	content: {
		paddingBottom: 40,
	},
	empty: {
		fontSize: 15,
		lineHeight: 20,
		paddingHorizontal: 32,
		paddingTop: 32,
		textAlign: "center",
	},
	header: {
		gap: 10,
		marginHorizontal: 16,
		marginTop: 4,
	},
	icon: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 10,
		height: ICON_SIZE,
		justifyContent: "center",
		overflow: "hidden",
		width: ICON_SIZE,
	},
	initial: {
		fontSize: 17,
		fontWeight: "700",
	},
	loading: {
		marginTop: 32,
	},
	m3Gap: {
		marginBottom: 2,
	},
	meta: {
		fontSize: 13,
		lineHeight: 18,
	},
	notice: {
		fontSize: 13,
		lineHeight: 18,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 64,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	rowBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	search: {
		marginHorizontal: -16,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 68,
	},
	subtitle: {
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
		marginHorizontal: 4,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
})
