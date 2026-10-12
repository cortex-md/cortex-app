import { ReadingView } from "@cortex/editor/reading-view"
import {
	formatManifestValue,
	getCapabilityLabel,
	getExternalUrl,
	getMarketplaceEntryState,
	getRepositoryLabel,
	getRepositoryUrl,
	isEntryInstalled,
	type MarketplaceTab,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
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
	ArrowUp,
	Download,
	ExternalLink,
	Package,
	ShieldCheckIcon,
	Trash2,
	TriangleAlert,
} from "lucide-react"
import { type ReactNode, useLayoutEffect, useRef } from "react"
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
				{ availableUpdates, appVersion, manifestMetadataCache },
				entry.id,
				isEntryInstalled(entry.id, tab),
			)
		: null
	const isInstalled = entryState?.installed ?? false
	const isLoading = loadingEntryId === entry?.id
	const installBlocked = tab === "plugins" && !allowCommunity
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
							<h2 title={entry.name}>{entry.name}</h2>
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
							{!hasVault ? (
								<Button variant="secondary" size="sm" disabled>
									Open a vault to install
								</Button>
							) : isInstalled && hasUpdate ? (
								<>
									<Button
										size="sm"
										onClick={() => void installEntry(entry, tab)}
										disabled={isLoading || installBlocked}
									>
										{isLoading ? <Spinner className="size-3" /> : <ArrowUp size={13} />}
										Update to {latestVersion}
									</Button>
									<Button
										variant="ghost"
										size="sm"
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
											size="sm"
											disabled={isThemeInUse}
											onClick={() => void applyMarketplaceTheme(entry)}
										>
											{isThemeInUse ? "In use" : "Use theme"}
										</Button>
									)}
									<Button
										variant="secondary"
										size="sm"
										onClick={() => void handleUninstall(entry)}
										disabled={isLoading}
										className="marketplace-uninstall"
									>
										{isLoading ? <Spinner className="size-3" /> : <Trash2 size={13} />}
										Uninstall
									</Button>
								</>
							) : installBlocked ? (
								<Button variant="secondary" size="sm" disabled>
									Allow community plugins to install
								</Button>
							) : (
								<Button
									size="sm"
									onClick={() => void installEntry(entry, tab)}
									disabled={isLoading}
								>
									{isLoading ? <Spinner className="size-3" /> : <Download size={13} />}
									Install
								</Button>
							)}
						</div>
					</header>

					<p className="marketplace-detail-lead">{entry.description}</p>

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
							<SettingsSection title="Information">
								<SettingsGroup>
									<SettingsList>
										<MarketplaceMetadataItem
											label={tab === "plugins" ? "Plugin version" : "Theme version"}
											value={manifestVersion}
										/>
										<MarketplaceMetadataItem label="Minimum Cortex" value={minimumAppVersion} />
										<MarketplaceMetadataItem label="Scope" value="This vault" />
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
