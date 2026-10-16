import { ReadingView } from "@cortex/editor/reading-view"
import {
	BLOCKLIST_UNAVAILABLE_MESSAGE,
	formatCount,
	formatManifestValue,
	formatStatsAge,
	getCapabilityLabel,
	getExternalUrl,
	getMarketplaceEntryState,
	getRepositoryLabel,
	getRepositoryUrl,
	getVoteUrl,
	isEntryInstalled,
	type MarketplaceEntryState,
	type MarketplaceTab,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import {
	Alert,
	AlertDescription,
	Button,
	Empty,
	EmptyDescription,
	EmptyMedia,
	ScrollArea,
	Skeleton,
	Spinner,
} from "@cortex/ui"
import {
	ArrowBigUp,
	ArrowUp,
	BadgeCheck,
	Ban,
	Download,
	ExternalLink,
	Package,
	ShieldAlert,
	ShieldCheckIcon,
	Trash2,
	TriangleAlert,
} from "lucide-react"
import { type ReactNode, useLayoutEffect, useRef } from "react"
import { runSettingsAction } from "@/features/settings/settingsActions"
import { useCommunityPluginsAllowed } from "../plugins/communityPluginsAccess"
import {
	SettingsGroup,
	SettingsIconTile,
	SettingsList,
	SettingsListItem,
	SettingsSection,
} from "../settings/SettingsPrimitives"
import { applyMarketplaceTheme, getMarketplaceThemeName } from "./marketplaceThemes"

interface MarketplaceDetailProps {
	tab: MarketplaceTab
	entry: RegistryEntry | null
	hasVault: boolean
}

function openExternalUrl(url: string) {
	void getPlatform().app.openExternalUrl(url)
}

function MarketplaceDetailArtwork({ entry }: { entry: RegistryEntry }) {
	return (
		<span className="marketplace-artwork marketplace-detail-artwork" aria-hidden="true">
			{entry.coverImageUrl ? (
				<img src={entry.coverImageUrl} alt="" />
			) : (
				entry.name.charAt(0).toUpperCase() || <Package size={24} />
			)}
		</span>
	)
}

function MarketplaceMetadataItem({ label, value }: { label: string; value: ReactNode }) {
	return (
		<SettingsListItem className="marketplace-metadata-item">
			<span className="settings-field-label">{label}</span>
			<span className="marketplace-metadata-value">{value}</span>
		</SettingsListItem>
	)
}

function MarketplaceRepositoryValue({
	entry,
	repositoryUrl,
}: {
	entry: RegistryEntry
	repositoryUrl: string
}) {
	return (
		<Button
			size="sm"
			variant="link"
			className="marketplace-repository-button"
			title={entry.repo}
			onClick={() => openExternalUrl(repositoryUrl)}
		>
			<span className="marketplace-repository-path">
				{getRepositoryLabel(entry.repo)}
				<ExternalLink size={11} />
			</span>
		</Button>
	)
}

function MarketplacePermissions({
	capabilities,
	loading,
}: {
	capabilities: string[]
	loading: boolean
}) {
	return (
		<SettingsSection
			title="Permissions"
			footer={
				loading
					? "Checking permissions..."
					: capabilities.length > 0
						? "Permissions apply to this vault only."
						: "No permissions declared"
			}
		>
			{capabilities.length > 0 && (
				<SettingsGroup>
					<SettingsList>
						{capabilities.map((capability) => (
							<SettingsListItem key={capability} data-has-icon="true">
								<SettingsIconTile>
									<ShieldCheckIcon />
								</SettingsIconTile>
								<span className="settings-field-label">{getCapabilityLabel(capability)}</span>
							</SettingsListItem>
						))}
					</SettingsList>
				</SettingsGroup>
			)}
		</SettingsSection>
	)
}

function MarketplaceTrustNotices({
	entry,
	tab,
	entryState,
}: {
	entry: RegistryEntry
	tab: MarketplaceTab
	entryState: MarketplaceEntryState
}) {
	const pluginEnabled = usePluginStore((state) => state.plugins[entry.id]?.status === "enabled")
	const kind = tab === "plugins" ? "plugin" : "theme"
	const audit = entryState.stats?.audit

	if (entryState.blockState === "item") {
		return (
			<Alert variant="destructive">
				<Ban size={14} />
				<AlertDescription>
					This {kind} was removed from the Marketplace: {entryState.blockReason}
					{entryState.installed && tab === "plugins" && pluginEnabled && (
						<Button
							variant="secondary"
							size="xs"
							className="marketplace-notice-action"
							onClick={() =>
								runSettingsAction("setPluginEnabled", { pluginId: entry.id, enabled: false })
							}
						>
							Disable plugin
						</Button>
					)}
				</AlertDescription>
			</Alert>
		)
	}

	return (
		<>
			{entryState.blocklistUnavailable && (
				<Alert>
					<ShieldAlert size={14} />
					<AlertDescription>{BLOCKLIST_UNAVAILABLE_MESSAGE}</AlertDescription>
				</Alert>
			)}
			{entryState.blockState === "versions" && (
				<Alert variant="destructive">
					<Ban size={14} />
					<AlertDescription>
						Version {entryState.blockedVersions.join(", ")} was pulled from the Marketplace:{" "}
						{entryState.blockReason}
					</AlertDescription>
				</Alert>
			)}
			{audit && audit.status !== "pass" && (
				<Alert variant={audit.status === "fail" ? "destructive" : "default"}>
					<ShieldAlert size={14} />
					<AlertDescription>
						{audit.status === "fail"
							? `The automated review flagged ${audit.checkedTag}. Maintainers are reviewing it.`
							: `The automated review found warnings in ${audit.checkedTag}.`}
						<ul className="marketplace-audit-issues">
							{audit.issues.slice(0, 3).map((issue) => (
								<li key={issue}>{issue}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}
		</>
	)
}

export function MarketplaceDetail({ tab, entry, hasVault }: MarketplaceDetailProps) {
	const loadingEntryId = useMarketplaceStore((state) => state.loadingEntryId)
	const readmeCache = useMarketplaceStore((state) => state.readmeCache)
	const readmeLoading = useMarketplaceStore((state) => state.readmeLoading)
	const appVersion = useMarketplaceStore((state) => state.appVersion)
	const manifestMetadataCache = useMarketplaceStore((state) => state.manifestMetadataCache)
	const manifestMetadataLoading = useMarketplaceStore((state) => state.manifestMetadataLoading)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const installError = useMarketplaceStore((state) => state.installError)
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const uninstallEntry = useMarketplaceStore((state) => state.uninstallEntry)
	const stats = useMarketplaceStore((state) => state.stats)
	const verified = useMarketplaceStore((state) => state.verified)
	const blocked = useMarketplaceStore((state) => state.blocked)
	const blocklistAvailable = useMarketplaceStore((state) => state.blocklistAvailable)
	const statsLoaded = useMarketplaceStore((state) => state.statsLoaded)
	const readmeScrollRef = useRef<HTMLElement>(null)
	const allowCommunity = useCommunityPluginsAllowed()

	const handleUninstall = async (uninstallEntryTarget: RegistryEntry) => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: "Uninstall",
			message: `Are you sure you want to uninstall "${uninstallEntryTarget.name}"?`,
			destructive: true,
			confirmLabel: "Uninstall",
		})
		if (!confirmed) return
		await uninstallEntry(uninstallEntryTarget, tab)
	}

	const entryState = entry
		? getMarketplaceEntryState(
				{
					availableUpdates,
					appVersion,
					manifestMetadataCache,
					stats,
					verified,
					blocked,
					blocklistAvailable,
					statsLoaded,
				},
				entry.id,
				isEntryInstalled(entry.id, tab),
				tab,
			)
		: null
	const isInstalled = entryState?.installed ?? false
	const isLoading = loadingEntryId === entry?.id
	const installBlocked = tab === "plugins" && !allowCommunity
	const marketplaceBlocked = entryState?.installBlocked ?? false
	const itemStats = entryState?.stats ?? null
	const voteUrl = entry ? getVoteUrl(stats, tab, entry.id) : null
	const statsAge = formatStatsAge(stats.generatedAt)
	const readme = entry ? readmeCache[entry.id] : undefined
	const manifestMetadata = entry ? manifestMetadataCache[entry.id] : undefined
	const isManifestLoading = entry ? Boolean(manifestMetadataLoading[entry.id]) : false
	const minVersion = entryState?.minAppVersion
	const latestVersion = entryState?.updateVersion
	const hasUpdate = entryState?.action === "update"
	const hasCompatibilityWarning = entryState?.incompatible ?? false
	const authorUrl = entry?.authorUrl ? getExternalUrl(entry.authorUrl) : null
	const repositoryUrl = entry?.repo ? getRepositoryUrl(entry.repo) : null
	const readmeScrollKey = entry?.id ?? ""
	const manifestVersion = formatManifestValue(manifestMetadata?.version, isManifestLoading)
	const minimumAppVersion = formatManifestValue(minVersion, isManifestLoading)
	const capabilities = manifestMetadata?.capabilities ?? []
	const activeTheme = useSettingsStore((state) => state.settings.appearance.theme)
	const isThemeInUse =
		tab === "themes" && entry !== null && getMarketplaceThemeName(entry) === activeTheme

	useLayoutEffect(() => {
		if (!readmeScrollKey) return

		const viewport = readmeScrollRef.current?.querySelector<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		)
		if (!viewport) return

		viewport.scrollTop = 0
		viewport.scrollLeft = 0
	}, [readmeScrollKey])

	if (!entry) {
		return (
			<section className="marketplace-detail">
				<Empty className="min-h-0 flex-1 border-none">
					<EmptyMedia variant="icon">
						<Package />
					</EmptyMedia>
					<EmptyDescription>
						Select a {tab === "plugins" ? "plugin" : "theme"} to view details and README.
					</EmptyDescription>
				</Empty>
			</section>
		)
	}

	return (
		<section ref={readmeScrollRef} className="marketplace-detail">
			<ScrollArea key={entry.id} className="h-full">
				<div className="marketplace-detail-page">
					<header className="marketplace-detail-hero">
						<MarketplaceDetailArtwork entry={entry} />
						<div className="marketplace-detail-hero-copy">
							<h2 title={entry.name}>
								{entry.name}
								{entryState?.verified && (
									<BadgeCheck
										className="marketplace-verified-badge"
										aria-label="Verified by Cortex"
									/>
								)}
							</h2>
							<div>
								<span>{entry.author}</span>
								{isInstalled && (
									<>
										<span aria-hidden="true">·</span>
										<span>{hasUpdate ? "Update available" : "Installed"}</span>
									</>
								)}
								{authorUrl && (
									<Button
										variant="ghost"
										size="xs"
										className="marketplace-author-link"
										onClick={() => openExternalUrl(authorUrl)}
									>
										Author
										<ExternalLink size={11} />
									</Button>
								)}
							</div>
						</div>
						<div className="marketplace-detail-actions">
							{voteUrl && (
								<Button
									variant="ghost"
									title="Votes are upvotes on GitHub Discussions; counts refresh every 30 minutes"
									onClick={() => openExternalUrl(voteUrl)}
								>
									<ArrowBigUp size={13} />
									Vote on GitHub
								</Button>
							)}
							{!hasVault ? (
								<Button variant="secondary" disabled>
									Open a vault to install
								</Button>
							) : isInstalled && hasUpdate ? (
								<>
									<Button
										onClick={() => void installEntry(entry, tab)}
										disabled={isLoading || installBlocked || marketplaceBlocked}
									>
										{isLoading ? <Spinner className="size-3" /> : <ArrowUp size={13} />}
										Update to {latestVersion}
									</Button>
									<Button
										variant="destructive-soft"
										onClick={() => void handleUninstall(entry)}
										disabled={isLoading}
										className="marketplace-uninstall"
									>
										<Trash2 size={13} />
										Uninstall
									</Button>
								</>
							) : isInstalled ? (
								<>
									{tab === "themes" && (
										<Button
											disabled={isThemeInUse}
											onClick={() => void applyMarketplaceTheme(entry)}
										>
											{isThemeInUse ? "In use" : "Use theme"}
										</Button>
									)}
									<Button
										variant="destructive-soft"
										onClick={() => void handleUninstall(entry)}
										disabled={isLoading}
										className="marketplace-uninstall"
									>
										{isLoading ? <Spinner className="size-3" /> : <Trash2 size={13} />}
										Uninstall
									</Button>
								</>
							) : installBlocked ? (
								<Button variant="secondary" disabled>
									Allow community plugins to install
								</Button>
							) : marketplaceBlocked ? (
								<Button variant="secondary" disabled>
									Not available
								</Button>
							) : (
								<Button onClick={() => void installEntry(entry, tab)} disabled={isLoading}>
									{isLoading ? <Spinner className="size-3" /> : <Download size={13} />}
									Install
								</Button>
							)}
						</div>
					</header>

					<p className="marketplace-detail-lead">{entry.description}</p>

					{entryState && (
						<MarketplaceTrustNotices entry={entry} tab={tab} entryState={entryState} />
					)}

					{hasCompatibilityWarning && (
						<Alert variant="destructive">
							<TriangleAlert size={14} />
							<AlertDescription>
								This {tab === "plugins" ? "plugin" : "theme"} requires Cortex v{minVersion} or
								later. You are running v{appVersion}.
							</AlertDescription>
						</Alert>
					)}

					{installError && (
						<Alert variant="destructive">
							<TriangleAlert size={14} />
							<AlertDescription>{installError}</AlertDescription>
						</Alert>
					)}

					{entry.screenshots && entry.screenshots.length > 0 && (
						<ul className="marketplace-screenshots" aria-label="Screenshots">
							{entry.screenshots.map((url, index) => (
								<li key={url}>
									<button type="button" onClick={() => openExternalUrl(url)} title="Open full size">
										<img
											src={url}
											alt={`${entry.name} screenshot ${index + 1}`}
											loading="lazy"
											decoding="async"
											referrerPolicy="no-referrer"
										/>
									</button>
								</li>
							))}
						</ul>
					)}

					<div className="marketplace-detail-body">
						<article className="marketplace-readme">
							{readmeLoading && readme === undefined ? (
								<div className="flex flex-col gap-3">
									<Skeleton className="h-4 w-2/3" />
									<Skeleton className="h-3 w-full" />
									<Skeleton className="h-3 w-4/5" />
									<Skeleton className="h-3 w-full" />
									<Skeleton className="h-3 w-3/4" />
								</div>
							) : readme ? (
								<ReadingView content={readme} onExternalLinkClick={(url) => openExternalUrl(url)} />
							) : (
								<Empty className="min-h-[240px] border-none">
									<EmptyDescription>No README available.</EmptyDescription>
								</Empty>
							)}
						</article>
						<aside
							className="marketplace-detail-aside"
							aria-label={tab === "plugins" ? "Plugin information" : "Theme information"}
						>
							<SettingsSection
								title="Information"
								footer={itemStats ? (statsAge ?? undefined) : undefined}
							>
								<SettingsGroup>
									<SettingsList>
										<MarketplaceMetadataItem
											label={tab === "plugins" ? "Plugin version" : "Theme version"}
											value={manifestVersion}
										/>
										<MarketplaceMetadataItem label="Minimum Cortex" value={minimumAppVersion} />
										<MarketplaceMetadataItem label="Scope" value="This vault" />
										{itemStats && (
											<>
												<MarketplaceMetadataItem
													label="Votes"
													value={formatCount(itemStats.votes)}
												/>
												<MarketplaceMetadataItem
													label="Downloads"
													value={formatCount(itemStats.downloads)}
												/>
												<MarketplaceMetadataItem
													label="GitHub stars"
													value={formatCount(itemStats.stars)}
												/>
											</>
										)}
										{repositoryUrl && (
											<MarketplaceMetadataItem
												label="Source"
												value={
													<MarketplaceRepositoryValue entry={entry} repositoryUrl={repositoryUrl} />
												}
											/>
										)}
									</SettingsList>
								</SettingsGroup>
							</SettingsSection>
							{tab === "plugins" && (
								<MarketplacePermissions
									key={entry.id}
									capabilities={capabilities}
									loading={isManifestLoading && !manifestMetadata}
								/>
							)}
						</aside>
					</div>
				</div>
			</ScrollArea>
		</section>
	)
}
