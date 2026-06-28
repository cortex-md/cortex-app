import { useVaultStore } from "@cortex/core"
import {
	isEntryInstalled,
	type MarketplaceSortOrder,
	type MarketplaceTab,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Empty,
	EmptyDescription,
	EmptyMedia,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	NativeSelect,
	NativeSelectOption,
	ScrollArea,
	Skeleton,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@cortex/ui"
import { ArrowUp, Package, PackageSearch, RefreshCw, Search, TriangleAlert } from "lucide-react"
import { type Ref, useEffect, useMemo, useRef, useState } from "react"
import { MarketplaceDetail } from "./MarketplaceDetail"

interface MarketplaceSectionProps {
	initialTab: MarketplaceTab
	initialSelectedEntryId?: string | null
	onTabChange?: (tab: MarketplaceTab) => void
}

interface MarketplaceCatalogRowProps {
	entry: RegistryEntry
	isActive: boolean
	isInstalled: boolean
	hasUpdate: boolean
	releaseDate?: string
	rowRef?: Ref<HTMLButtonElement>
	onSelect: () => void
}

const marketplaceSortLabels: Record<MarketplaceSortOrder, string> = {
	default: "Curated",
	newest: "Newest first",
	oldest: "Oldest first",
}

const releaseDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
})

function formatReleaseDate(value?: string): string | null {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return releaseDateFormatter.format(date)
}

function matchesEntry(entry: RegistryEntry, query: string): boolean {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return true
	return (
		entry.name.toLowerCase().includes(normalized) ||
		entry.author.toLowerCase().includes(normalized) ||
		entry.description.toLowerCase().includes(normalized) ||
		entry.repo.toLowerCase().includes(normalized)
	)
}

function MarketplaceArtwork({ entry }: { entry: RegistryEntry }) {
	return (
		<div className="marketplace-artwork flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-tertiary text-text-muted">
			{entry.coverImageUrl ? (
				<img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
			) : (
				<Package size={18} />
			)}
		</div>
	)
}

function MarketplaceCatalogRow({
	entry,
	isActive,
	isInstalled,
	hasUpdate,
	releaseDate,
	rowRef,
	onSelect,
}: MarketplaceCatalogRowProps) {
	const formattedReleaseDate = formatReleaseDate(releaseDate)

	return (
		<button
			ref={rowRef}
			type="button"
			className="marketplace-catalog-row"
			aria-current={isActive ? "true" : undefined}
			data-active={isActive}
			onClick={onSelect}
		>
			<MarketplaceArtwork entry={entry} />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-2">
					<span className="truncate text-[13px] font-semibold text-text-primary">{entry.name}</span>
					{hasUpdate && (
						<Badge variant="secondary" className="h-5 shrink-0 gap-1 px-1.5 text-[10px]">
							<ArrowUp size={10} />
							Update
						</Badge>
					)}
					{isInstalled && !hasUpdate && (
						<Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
							Installed
						</Badge>
					)}
				</div>
				<p className="line-clamp-2 text-left text-xs leading-5 text-text-muted">
					{entry.description}
				</p>
				<div className="flex min-w-0 items-center gap-2 text-[11px] text-text-muted">
					<span className="truncate">by {entry.author}</span>
					{formattedReleaseDate && (
						<>
							<span aria-hidden="true">/</span>
							<span className="shrink-0 tabular-nums">{formattedReleaseDate}</span>
						</>
					)}
				</div>
			</div>
		</button>
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
	const {
		activeTab,
		pluginEntries,
		themeEntries,
		searchQuery,
		filterInstalled,
		sortOrder,
		selectedEntryId,
		registryError,
		availableUpdates,
		updatesChecking,
		releaseDates,
		releaseDatesLoading,
	} = useMarketplaceStore()
	const setActiveTab = useMarketplaceStore((state) => state.setActiveTab)
	const setSearchQuery = useMarketplaceStore((state) => state.setSearchQuery)
	const setFilterInstalled = useMarketplaceStore((state) => state.setFilterInstalled)
	const setSortOrder = useMarketplaceStore((state) => state.setSortOrder)
	const selectEntry = useMarketplaceStore((state) => state.selectEntry)
	const refreshRegistry = useMarketplaceStore((state) => state.refreshRegistry)
	const loadRegistry = useMarketplaceStore((state) => state.loadRegistry)
	const loadReadme = useMarketplaceStore((state) => state.loadReadme)
	const loadManifestMetadata = useMarketplaceStore((state) => state.loadManifestMetadata)

	useEffect(() => {
		let cancelled = false
		setActiveTab(initialTab)
		if (initialSelectedEntryId) {
			selectEntry(initialSelectedEntryId)
		}
		void loadRegistry().finally(() => {
			if (!cancelled) setRegistryLoaded(true)
		})
		return () => {
			cancelled = true
		}
	}, [initialSelectedEntryId, initialTab, loadRegistry, selectEntry, setActiveTab])

	const allEntries = activeTab === "plugins" ? pluginEntries : themeEntries
	const isLoading = !registryLoaded && allEntries.length === 0 && !registryError

	const filteredEntries = useMemo(() => {
		let entries = allEntries.filter((entry) => matchesEntry(entry, searchQuery))

		if (filterInstalled) {
			entries = entries.filter((entry) => isEntryInstalled(entry.id, activeTab))
		}

		if (sortOrder !== "default") {
			entries = [...entries].sort((a, b) => {
				const dateA = releaseDates[a.id] ? new Date(releaseDates[a.id]).getTime() : 0
				const dateB = releaseDates[b.id] ? new Date(releaseDates[b.id]).getTime() : 0
				return sortOrder === "newest" ? dateB - dateA : dateA - dateB
			})
		}

		return entries
	}, [activeTab, allEntries, filterInstalled, releaseDates, searchQuery, sortOrder])

	const selectedEntry =
		filteredEntries.find((entry) => entry.id === selectedEntryId) ??
		allEntries.find((entry) => entry.id === selectedEntryId) ??
		null

	const updateCount = allEntries.filter(
		(entry) => isEntryInstalled(entry.id, activeTab) && availableUpdates[entry.id],
	).length
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

	const handleTabChange = (tab: MarketplaceTab) => {
		setActiveTab(tab)
		onTabChange?.(tab)
	}

	const handleEntrySelect = (entry: RegistryEntry) => {
		selectEntry(entry.id)
	}

	const handleRefresh = () => {
		setRegistryLoaded(false)
		void refreshRegistry().finally(() => setRegistryLoaded(true))
	}

	return (
		<section className="marketplace-view flex h-full min-h-0 flex-col overflow-hidden bg-bg-primary">
			<header className="marketplace-toolbar shrink-0 border-b border-border-subtle px-5 py-4">
				<div className="flex flex-col gap-4">
					<div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<div className="min-w-0">
							<h1 className="m-0 text-base font-semibold leading-6 text-text-primary text-balance">
								Marketplace
							</h1>
							<p className="m-0 max-w-[64ch] text-xs leading-5 text-text-muted text-pretty">
								Discover vault-scoped plugins and themes for the current workspace.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Tabs
								value={activeTab}
								onValueChange={(value) => handleTabChange(value as MarketplaceTab)}
							>
								<TabsList>
									<TabsTrigger value="plugins">Plugins</TabsTrigger>
									<TabsTrigger value="themes">Themes</TabsTrigger>
								</TabsList>
							</Tabs>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Refresh marketplace"
								onClick={handleRefresh}
							>
								<RefreshCw size={14} />
							</Button>
						</div>
					</div>
					<div className="flex flex-col gap-2 lg:flex-row lg:items-center">
						<InputGroup variant="search" className="min-w-0 flex-1">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								placeholder={`Search ${activeTab}...`}
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
							/>
						</InputGroup>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant={filterInstalled ? "secondary" : "ghost"}
								size="sm"
								aria-pressed={filterInstalled}
								onClick={() => setFilterInstalled(!filterInstalled)}
							>
								Installed
							</Button>
							<NativeSelect
								size="sm"
								value={sortOrder}
								aria-label="Marketplace sort order"
								onChange={(event) => setSortOrder(event.target.value as MarketplaceSortOrder)}
							>
								{Object.entries(marketplaceSortLabels).map(([value, label]) => (
									<NativeSelectOption key={value} value={value}>
										{label}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<div className="marketplace-count-pill">
								<span className="tabular-nums">
									{filteredEntries.length}
									{filteredEntries.length !== allEntries.length ? `/${allEntries.length}` : ""}
								</span>
								<span>{activeTab}</span>
							</div>
							{updateCount > 0 && (
								<div className="marketplace-update-pill">
									<ArrowUp size={12} />
									<span className="tabular-nums">{updateCount}</span>
									<span>update{updateCount === 1 ? "" : "s"}</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</header>

			<div
				className="marketplace-shell min-h-0 flex-1 overflow-hidden"
				data-has-selection={hasSelection}
			>
				<aside className="marketplace-catalog min-h-0 overflow-hidden border-r border-border-subtle">
					{registryError && (
						<div className="border-b border-border-subtle p-3">
							<Alert variant="destructive">
								<TriangleAlert size={14} />
								<AlertDescription className="flex min-w-0 items-center justify-between gap-3">
									<span>Failed to load registry.</span>
									<Button variant="ghost" size="xs" onClick={handleRefresh}>
										Retry
									</Button>
								</AlertDescription>
							</Alert>
						</div>
					)}

					{updatesChecking && !isLoading && (
						<div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[11px] text-text-muted">
							<Spinner className="size-3" />
							Checking installed updates...
						</div>
					)}

					{releaseDatesLoading && sortOrder !== "default" && !isLoading && (
						<div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[11px] text-text-muted">
							<Spinner className="size-3" />
							Loading release dates...
						</div>
					)}

					<ScrollArea className="h-full">
						{isLoading && <MarketplaceCatalogSkeleton />}

						{!isLoading && filteredEntries.length === 0 && !registryError && (
							<Empty className="min-h-[360px] border-none">
								<EmptyMedia variant="icon">
									{hasSearch ? <PackageSearch /> : <Package />}
								</EmptyMedia>
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
								{filteredEntries.map((entry) => (
									<MarketplaceCatalogRow
										key={entry.id}
										entry={entry}
										isActive={entry.id === selectedEntryId}
										isInstalled={isEntryInstalled(entry.id, activeTab)}
										hasUpdate={Boolean(availableUpdates[entry.id])}
										releaseDate={releaseDates[entry.id]}
										rowRef={entry.id === selectedEntryId ? selectedRowRef : undefined}
										onSelect={() => handleEntrySelect(entry)}
									/>
								))}
							</div>
						)}
					</ScrollArea>
				</aside>

				{hasSelection && (
					<MarketplaceDetail
						tab={activeTab}
						entry={selectedEntry}
						hasVault={Boolean(vault)}
						onBack={() => selectEntry(null)}
					/>
				)}
			</div>
		</section>
	)
}
