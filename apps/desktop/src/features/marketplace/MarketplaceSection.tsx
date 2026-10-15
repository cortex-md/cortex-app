import { useVaultStore } from "@cortex/core"
import {
	formatCount,
	getItemStats,
	groupMarketplaceEntries,
	isEntryInstalled,
	isVerifiedEntry,
	type MarketplaceItemStats,
	type MarketplaceSortOrder,
	type MarketplaceTab,
	marketplaceSortLabels,
	type RegistryEntry,
	selectMarketplaceEntries,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { useSettingsStore } from "@cortex/settings"
import {
	Alert,
	AlertDescription,
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	EmptyDescription,
	EmptyMedia,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	ScrollArea,
	Skeleton,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@cortex/ui"
import {
	ArrowBigUp,
	BadgeCheck,
	CheckIcon,
	ChevronDown,
	Download,
	MoreHorizontal,
	Package,
	PackageSearch,
	RefreshCw,
	Search,
	TriangleAlert,
} from "lucide-react"
import {
	type ReactNode,
	type Ref,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react"
import { formatShortDate } from "@/utils/format"
import {
	CommunityPluginsNotice,
	useCommunityPluginsAllowed,
} from "../plugins/communityPluginsAccess"
import { MarketplaceDetail } from "./MarketplaceDetail"
import { applyMarketplaceTheme, getMarketplaceThemeName } from "./marketplaceThemes"
import type { MarketplaceViewTab } from "./marketplaceWorkspaceView"

interface MarketplaceSectionProps {
	initialTab: MarketplaceTab
	initialSelectedEntryId?: string | null
	onTabChange?: (tab: MarketplaceViewTab) => void
}

interface MarketplaceCatalogRowProps {
	entry: RegistryEntry
	tab: MarketplaceTab
	isActive: boolean
	isInstalled: boolean
	hasUpdate: boolean
	canInstall: boolean
	releaseDate?: string
	stats: MarketplaceItemStats | null
	verified: boolean
	rowRef?: Ref<HTMLButtonElement>
	onSelect: () => void
}

function MarketplaceRowAction({
	entry,
	tab,
	isInstalled,
	hasUpdate,
	canInstall,
}: Pick<MarketplaceCatalogRowProps, "entry" | "tab" | "isInstalled" | "hasUpdate" | "canInstall">) {
	const loading = useMarketplaceStore((state) => state.loadingEntryId === entry.id)
	const activeTheme = useSettingsStore((state) => state.settings.appearance.theme)
	const install = () => void useMarketplaceStore.getState().installEntry(entry, tab)
	if (loading) return <Spinner className="size-3" />
	if (hasUpdate && canInstall) {
		return (
			<Button variant="secondary" size="xs" onClick={install}>
				Update
			</Button>
		)
	}
	if (!isInstalled) {
		return canInstall ? (
			<Button variant="outline" size="xs" onClick={install}>
				Install
			</Button>
		) : null
	}
	if (tab !== "themes") return null
	return getMarketplaceThemeName(entry) === activeTheme ? (
		<CheckIcon className="marketplace-catalog-in-use" aria-label="In use" />
	) : (
		<Button variant="ghost" size="xs" onClick={() => void applyMarketplaceTheme(entry)}>
			Use
		</Button>
	)
}

function formatReleaseDate(value?: string): string | null {
	if (!value || Number.isNaN(new Date(value).getTime())) return null
	return formatShortDate(value)
}

function MarketplaceArtwork({ entry }: { entry: RegistryEntry }) {
	return (
		<span className="marketplace-artwork" aria-hidden="true">
			{entry.coverImageUrl ? (
				<img src={entry.coverImageUrl} alt="" />
			) : (
				entry.name.charAt(0).toUpperCase() || <Package size={16} />
			)}
		</span>
	)
}

function MarketplaceCatalogRow({
	entry,
	tab,
	isActive,
	isInstalled,
	hasUpdate,
	canInstall,
	releaseDate,
	stats,
	verified,
	rowRef,
	onSelect,
}: MarketplaceCatalogRowProps) {
	const formattedReleaseDate = formatReleaseDate(releaseDate)

	return (
		<div className="marketplace-catalog-item" data-active={isActive}>
			<Button
				size="sm"
				ref={rowRef}
				variant="ghost"
				type="button"
				className="marketplace-catalog-row"
				aria-current={isActive ? "true" : undefined}
				data-active={isActive}
				data-installed={isInstalled}
				title={entry.description}
				onClick={onSelect}
			>
				<MarketplaceArtwork entry={entry} />
				<span className="marketplace-catalog-copy">
					<span className="marketplace-catalog-title">
						{entry.name}
						{verified && (
							<BadgeCheck className="marketplace-verified-badge" aria-label="Verified by Cortex" />
						)}
					</span>
					<span className="marketplace-catalog-meta">
						{entry.author}
						{formattedReleaseDate && ` · ${formattedReleaseDate}`}
					</span>
					{stats && (stats.votes !== undefined || stats.downloads !== undefined) && (
						<span className="marketplace-catalog-stats">
							<span title="Votes on GitHub">
								<ArrowBigUp aria-hidden="true" />
								{formatCount(stats.votes)}
							</span>
							<span title="Downloads">
								<Download aria-hidden="true" />
								{formatCount(stats.downloads)}
							</span>
						</span>
					)}
				</span>
			</Button>
			<span className="marketplace-catalog-action">
				<MarketplaceRowAction
					entry={entry}
					tab={tab}
					isInstalled={isInstalled}
					hasUpdate={hasUpdate}
					canInstall={canInstall}
				/>
			</span>
		</div>
	)
}

interface MarketplaceCatalogGroupProps {
	label: string
	count: number
	children: ReactNode
}

function MarketplaceCatalogGroup({ label, count, children }: MarketplaceCatalogGroupProps) {
	const [open, setOpen] = useState(true)
	return (
		<div className="marketplace-catalog-group">
			<Button
				size="sm"
				variant="ghost"
				type="button"
				className="marketplace-catalog-group-header"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<ChevronDown className="marketplace-catalog-group-chevron" />
				<span>{label}</span>
				<b>{count}</b>
			</Button>
			{open && children}
		</div>
	)
}

function MarketplaceCatalogSkeleton() {
	return (
		<div className="marketplace-catalog-list">
			{["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6"].map((key) => (
				<div key={key} className="flex min-h-[92px] gap-3 rounded-lg px-3 py-3">
					<Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton className="h-3 w-2/3" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-4/5" />
						<Skeleton className="h-2.5 w-1/3" />
					</div>
				</div>
			))}
		</div>
	)
}

export function MarketplaceSection({
	initialTab,
	initialSelectedEntryId = null,
	onTabChange,
}: MarketplaceSectionProps) {
	const vault = useVaultStore((state) => state.vault)
	const [registryLoaded, setRegistryLoaded] = useState(false)
	const selectedRowRef = useRef<HTMLButtonElement>(null)
	const activeTab = useMarketplaceStore((state) => state.activeTab)
	const allowCommunity = useCommunityPluginsAllowed()
	const pluginEntries = useMarketplaceStore((state) => state.pluginEntries)
	const themeEntries = useMarketplaceStore((state) => state.themeEntries)
	const searchQuery = useMarketplaceStore((state) => state.searchQuery)
	const filterInstalled = useMarketplaceStore((state) => state.filterInstalled)
	const sortOrder = useMarketplaceStore((state) => state.sortOrder)
	const selectedEntryId = useMarketplaceStore((state) => state.selectedEntryId)
	const registryError = useMarketplaceStore((state) => state.registryError)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const updatesChecking = useMarketplaceStore((state) => state.updatesChecking)
	const releaseDates = useMarketplaceStore((state) => state.releaseDates)
	const releaseDatesLoading = useMarketplaceStore((state) => state.releaseDatesLoading)
	const stats = useMarketplaceStore((state) => state.stats)
	const verified = useMarketplaceStore((state) => state.verified)
	const blocked = useMarketplaceStore((state) => state.blocked)
	const setActiveTab = useMarketplaceStore((state) => state.setActiveTab)
	const setSearchQuery = useMarketplaceStore((state) => state.setSearchQuery)
	const setFilterInstalled = useMarketplaceStore((state) => state.setFilterInstalled)
	const setSortOrder = useMarketplaceStore((state) => state.setSortOrder)
	const selectEntry = useMarketplaceStore((state) => state.selectEntry)
	const refreshRegistry = useMarketplaceStore((state) => state.refreshRegistry)
	const loadRegistry = useMarketplaceStore((state) => state.loadRegistry)
	const loadReadme = useMarketplaceStore((state) => state.loadReadme)
	const loadManifestMetadata = useMarketplaceStore((state) => state.loadManifestMetadata)

	const applyInitialSelection = useEffectEvent(() => {
		setActiveTab(initialTab)
		if (initialSelectedEntryId) selectEntry(initialSelectedEntryId)
	})

	useEffect(() => {
		let cancelled = false
		applyInitialSelection()
		void loadRegistry().finally(() => {
			if (!cancelled) setRegistryLoaded(true)
		})
		return () => {
			cancelled = true
		}
	}, [loadRegistry])

	const allEntries = activeTab === "plugins" ? pluginEntries : themeEntries
	const isLoading = !registryLoaded && allEntries.length === 0 && !registryError

	const filteredEntries = useMemo(
		() =>
			selectMarketplaceEntries(
				{
					activeTab,
					pluginEntries,
					themeEntries,
					searchQuery,
					filterInstalled,
					sortOrder,
					releaseDates,
					stats,
					blocked,
				},
				{ isInstalled: (id) => isEntryInstalled(id, activeTab) },
			),
		[
			activeTab,
			blocked,
			filterInstalled,
			pluginEntries,
			releaseDates,
			searchQuery,
			sortOrder,
			stats,
			themeEntries,
		],
	)

	const selectedEntry =
		filteredEntries.find((entry) => entry.id === selectedEntryId) ??
		allEntries.find((entry) => entry.id === selectedEntryId) ??
		null

	const hasSelection = Boolean(selectedEntry)
	const hasSearch = searchQuery.trim().length > 0

	useEffect(() => {
		if (!selectedEntry) return
		void Promise.all([loadReadme(selectedEntry), loadManifestMetadata(selectedEntry)])
	}, [loadManifestMetadata, loadReadme, selectedEntry])

	useEffect(() => {
		if (!selectedEntry) return
		selectedRowRef.current?.scrollIntoView({ block: "nearest" })
	}, [selectedEntry])

	const handleTabChange = (tab: MarketplaceViewTab) => {
		if (tab !== "templates") setActiveTab(tab)
		onTabChange?.(tab)
	}

	const handleEntrySelect = (entry: RegistryEntry) => {
		selectEntry(entry.id)
	}

	const handleRefresh = () => {
		setRegistryLoaded(false)
		void refreshRegistry().finally(() => setRegistryLoaded(true))
	}

	const renderRow = (entry: RegistryEntry) => (
		<MarketplaceCatalogRow
			key={entry.id}
			entry={entry}
			tab={activeTab}
			isActive={entry.id === selectedEntryId}
			isInstalled={isEntryInstalled(entry.id, activeTab)}
			hasUpdate={Boolean(availableUpdates[entry.id])}
			canInstall={Boolean(vault) && (activeTab === "themes" || allowCommunity)}
			releaseDate={releaseDates[entry.id]}
			stats={getItemStats(stats, activeTab, entry.id)}
			verified={isVerifiedEntry(verified, activeTab, entry.id)}
			rowRef={entry.id === selectedEntryId ? selectedRowRef : undefined}
			onSelect={() => handleEntrySelect(entry)}
		/>
	)
	const entryGroups = groupMarketplaceEntries(filteredEntries, {
		isInstalled: (id) => isEntryInstalled(id, activeTab),
		availableUpdates,
	})

	return (
		<section className="marketplace-view" data-has-selection={hasSelection}>
			<aside className="marketplace-catalog">
				<header className="marketplace-catalog-header">
					<h1>Marketplace</h1>
					<span className="marketplace-catalog-actions">
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Refresh marketplace"
							onClick={handleRefresh}
						>
							<RefreshCw size={14} />
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-xs" aria-label="Marketplace view options">
									<MoreHorizontal size={14} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuCheckboxItem
									checked={filterInstalled}
									onCheckedChange={(checked) => setFilterInstalled(checked === true)}
								>
									Installed only
								</DropdownMenuCheckboxItem>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Sort</DropdownMenuLabel>
								<DropdownMenuRadioGroup
									value={sortOrder}
									onValueChange={(value) => setSortOrder(value as MarketplaceSortOrder)}
								>
									{Object.entries(marketplaceSortLabels).map(([value, label]) => (
										<DropdownMenuRadioItem key={value} value={value}>
											{label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</span>
				</header>
				<InputGroup variant="search" className="marketplace-catalog-search">
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
					<InputGroupInput
						placeholder={`Search ${activeTab}...`}
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
					/>
				</InputGroup>
				<Tabs
					value={activeTab}
					onValueChange={(value) => handleTabChange(value as MarketplaceViewTab)}
				>
					<TabsList className="marketplace-catalog-tabs">
						<TabsTrigger value="plugins">Plugins</TabsTrigger>
						<TabsTrigger value="themes">Themes</TabsTrigger>
						<TabsTrigger value="templates">Templates</TabsTrigger>
					</TabsList>
				</Tabs>

				{activeTab === "plugins" && !allowCommunity && (
					<CommunityPluginsNotice className="marketplace-catalog-alert" />
				)}

				{registryError && (
					<Alert variant="destructive" className="marketplace-catalog-alert">
						<TriangleAlert size={14} />
						<AlertDescription className="flex min-w-0 items-center justify-between gap-3">
							<span>Failed to load registry.</span>
							<Button variant="ghost" size="xs" onClick={handleRefresh}>
								Retry
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{updatesChecking && !isLoading && (
					<div className="marketplace-catalog-status">
						<Spinner className="size-3" />
						Checking installed updates...
					</div>
				)}

				{releaseDatesLoading &&
					(sortOrder === "newest" || sortOrder === "oldest") &&
					!isLoading && (
						<div className="marketplace-catalog-status">
							<Spinner className="size-3" />
							Loading release dates...
						</div>
					)}

				<ScrollArea className="marketplace-catalog-scroll">
					{isLoading && <MarketplaceCatalogSkeleton />}

					{!isLoading && filteredEntries.length === 0 && !registryError && (
						<Empty className="min-h-[360px] border-none">
							<EmptyMedia variant="icon">{hasSearch ? <PackageSearch /> : <Package />}</EmptyMedia>
							<EmptyDescription>
								{hasSearch
									? `No ${activeTab} match your search.`
									: filterInstalled
										? `No installed ${activeTab} found.`
										: `No ${activeTab} are available yet.`}
							</EmptyDescription>
						</Empty>
					)}

					{filteredEntries.length > 0 && (
						<div className="marketplace-catalog-list">
							{entryGroups.map((group) => (
								<MarketplaceCatalogGroup
									key={group.key}
									label={group.label}
									count={group.entries.length}
								>
									{group.entries.map(renderRow)}
								</MarketplaceCatalogGroup>
							))}
						</div>
					)}
				</ScrollArea>
			</aside>

			{hasSelection ? (
				<MarketplaceDetail tab={activeTab} entry={selectedEntry} hasVault={Boolean(vault)} />
			) : (
				<div className="marketplace-detail-empty">
					<Empty className="border-none">
						<EmptyMedia variant="icon">
							<Package />
						</EmptyMedia>
						<EmptyDescription>Pick a plugin or theme to see its details.</EmptyDescription>
					</Empty>
				</div>
			)}
		</section>
	)
}
