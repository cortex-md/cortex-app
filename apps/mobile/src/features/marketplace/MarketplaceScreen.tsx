import {
	groupMarketplaceEntries,
	type MarketplaceSortOrder,
	marketplaceSortLabels,
	type RegistryEntry,
	selectMarketplaceEntries,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { usePluginStore } from "@cortex/plugin-host-core"
import { Stack } from "expo-router"
import { ChevronRight } from "lucide-react-native"
import { useEffect, useState } from "react"
import {
	ActivityIndicator,
	Image,
	Pressable,
	SectionList,
	StyleSheet,
	Text,
	View,
} from "react-native"

import { openMarketplaceEntry } from "@/features/marketplace/marketplaceNavigation"
import {
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import { useMobileColors } from "@/hooks/useMobileColors"

const sortOrders = Object.keys(marketplaceSortLabels) as MarketplaceSortOrder[]

function formatReleaseDate(value: string | undefined): string | null {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function MarketplaceArtwork({ entry, size }: { entry: RegistryEntry; size: number }) {
	const { colors } = useMobileColors()
	const frameStyle = [
		styles.artwork,
		{ backgroundColor: colors.secondaryBackground, height: size, width: size },
	]
	if (entry.coverImageUrl) {
		return <Image source={{ uri: entry.coverImageUrl }} style={frameStyle} />
	}
	return (
		<View style={frameStyle}>
			<Text style={[styles.artworkInitial, { color: colors.secondaryLabel }]}>
				{entry.name.charAt(0).toUpperCase()}
			</Text>
		</View>
	)
}

function MarketplaceRow({
	entry,
	hasUpdate,
	releaseDate,
}: {
	entry: RegistryEntry
	hasUpdate: boolean
	releaseDate: string | undefined
}) {
	const { colors, iconColors } = useMobileColors()
	const formattedDate = formatReleaseDate(releaseDate)

	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => openMarketplaceEntry(entry.id)}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: pressed ? colors.secondaryBackground : colors.background },
			]}
		>
			<MarketplaceArtwork entry={entry} size={44} />
			<View style={styles.rowContent}>
				<Text numberOfLines={1} style={[styles.rowTitle, { color: colors.label }]}>
					{entry.name}
				</Text>
				<Text numberOfLines={2} style={[styles.rowDescription, { color: colors.secondaryLabel }]}>
					{entry.description}
				</Text>
				<Text numberOfLines={1} style={[styles.rowMeta, { color: colors.secondaryLabel }]}>
					{formattedDate ? `${entry.author} · ${formattedDate}` : entry.author}
				</Text>
			</View>
			{hasUpdate ? (
				<Text style={[styles.badge, { borderColor: colors.tint, color: colors.tint }]}>Update</Text>
			) : null}
			<ChevronRight color={iconColors.secondary} size={18} />
		</Pressable>
	)
}

export function MarketplaceScreen() {
	const { colors } = useMobileColors()
	const [registryLoaded, setRegistryLoaded] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const plugins = usePluginStore((state) => state.plugins)
	const activeTab = useMarketplaceStore((state) => state.activeTab)
	const pluginEntries = useMarketplaceStore((state) => state.pluginEntries)
	const themeEntries = useMarketplaceStore((state) => state.themeEntries)
	const searchQuery = useMarketplaceStore((state) => state.searchQuery)
	const filterInstalled = useMarketplaceStore((state) => state.filterInstalled)
	const sortOrder = useMarketplaceStore((state) => state.sortOrder)
	const releaseDates = useMarketplaceStore((state) => state.releaseDates)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const registryError = useMarketplaceStore((state) => state.registryError)
	const updatesChecking = useMarketplaceStore((state) => state.updatesChecking)
	const allowCommunity = useCommunityPluginsAllowed()
	const setActiveTab = useMarketplaceStore((state) => state.setActiveTab)
	const setSearchQuery = useMarketplaceStore((state) => state.setSearchQuery)
	const setFilterInstalled = useMarketplaceStore((state) => state.setFilterInstalled)
	const setSortOrder = useMarketplaceStore((state) => state.setSortOrder)
	const loadRegistry = useMarketplaceStore((state) => state.loadRegistry)
	const refreshRegistry = useMarketplaceStore((state) => state.refreshRegistry)

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

	const isInstalled = (entryId: string) => entryId in plugins
	const entries = selectMarketplaceEntries(
		{
			activeTab,
			pluginEntries,
			themeEntries,
			searchQuery,
			filterInstalled,
			sortOrder,
			releaseDates,
		},
		{ isInstalled },
	)
	const sections = groupMarketplaceEntries(entries, { isInstalled, availableUpdates }).map(
		(group) => ({ ...group, data: group.entries }),
	)

	const handleRefresh = () => {
		setRefreshing(true)
		void refreshRegistry().finally(() => setRefreshing(false))
	}

	const emptyMessage = registryError
		? "Unable to load the plugin registry. Pull to retry."
		: searchQuery.trim()
			? "No plugins match your search."
			: filterInstalled
				? "No installed plugins found."
				: "No plugins are available yet."

	return (
		<>
			<Stack.Screen options={{ title: "Community plugins" }} />
			<Stack.SearchBar
				hideWhenScrolling={false}
				onChangeText={(event) => setSearchQuery(event.nativeEvent.text)}
				placeholder="Search plugins"
			/>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu
					accessibilityLabel="Marketplace view options"
					icon="line.3.horizontal.decrease.circle"
					title="View"
				>
					<Stack.Toolbar.MenuAction
						isOn={filterInstalled}
						onPress={() => setFilterInstalled(!filterInstalled)}
					>
						Installed only
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.Menu inline title="Sort">
						{sortOrders.map((order) => (
							<Stack.Toolbar.MenuAction
								isOn={sortOrder === order}
								key={order}
								onPress={() => setSortOrder(order)}
							>
								{marketplaceSortLabels[order]}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
			<SectionList
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(entry) => entry.id}
				ListEmptyComponent={
					registryLoaded ? (
						<Text style={[styles.message, { color: colors.secondaryLabel }]}>{emptyMessage}</Text>
					) : (
						<ActivityIndicator color={colors.tint} style={styles.loading} />
					)
				}
				ListHeaderComponent={
					<>
						{allowCommunity ? null : (
							<Pressable
								accessibilityRole="button"
								onPress={() => void setCommunityPluginsAllowed(true)}
							>
								<Text style={[styles.status, { color: colors.secondaryLabel }]}>
									Community plugins are turned off.{" "}
									<Text style={{ color: colors.tint }}>Turn on to install</Text>
								</Text>
							</Pressable>
						)}
						{updatesChecking ? (
							<Text style={[styles.status, { color: colors.secondaryLabel }]}>
								Checking installed updates...
							</Text>
						) : null}
					</>
				}
				onRefresh={handleRefresh}
				refreshing={refreshing}
				renderItem={({ item }) => (
					<MarketplaceRow
						entry={item}
						hasUpdate={Boolean(availableUpdates[item.id])}
						releaseDate={releaseDates[item.id]}
					/>
				)}
				renderSectionHeader={({ section }) => (
					<Text
						style={[
							styles.sectionHeader,
							{ backgroundColor: colors.background, color: colors.secondaryLabel },
						]}
					>
						{`${section.label} · ${section.data.length}`}
					</Text>
				)}
				sections={sections}
				style={{ backgroundColor: colors.background }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	artwork: {
		alignItems: "center",
		borderRadius: 10,
		justifyContent: "center",
		overflow: "hidden",
	},
	artworkInitial: {
		fontSize: 18,
		fontWeight: "700",
	},
	badge: {
		borderRadius: 6,
		borderWidth: StyleSheet.hairlineWidth,
		fontSize: 12,
		fontWeight: "600",
		overflow: "hidden",
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	loading: {
		marginTop: 32,
	},
	message: {
		fontSize: 15,
		lineHeight: 21,
		paddingHorizontal: 20,
		paddingTop: 32,
		textAlign: "center",
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	rowContent: {
		flex: 1,
		gap: 2,
	},
	rowDescription: {
		fontSize: 14,
		lineHeight: 19,
	},
	rowMeta: {
		fontSize: 12,
		lineHeight: 16,
	},
	rowTitle: {
		fontSize: 16,
		fontWeight: "600",
		lineHeight: 21,
	},
	sectionHeader: {
		fontSize: 13,
		fontWeight: "600",
		paddingBottom: 6,
		paddingHorizontal: 16,
		paddingTop: 16,
		textTransform: "uppercase",
	},
	status: {
		fontSize: 13,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
})
