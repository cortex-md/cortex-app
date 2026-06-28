import { ReadingView } from "@cortex/editor/reading-view"
import {
	isEntryInstalled,
	isVersionCompatible,
	type MarketplaceTab,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Empty,
	EmptyDescription,
	EmptyMedia,
	ScrollArea,
	Skeleton,
	Spinner,
} from "@cortex/ui"
import {
	ArrowLeft,
	ArrowUp,
	ChevronDown,
	Download,
	ExternalLink,
	Package,
	Trash2,
	TriangleAlert,
} from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"

interface MarketplaceDetailProps {
	tab: MarketplaceTab
	entry: RegistryEntry | null
	hasVault: boolean
	onBack: () => void
}

function getExternalUrl(value: string) {
	if (value.startsWith("http://") || value.startsWith("https://")) return value
	return `https://${value}`
}

function getRepositoryUrl(value: string) {
	if (value.startsWith("http://") || value.startsWith("https://")) return value
	if (value.startsWith("github.com/")) return `https://${value}`
	return `https://github.com/${value}`
}

function getRepositoryLabel(value: string) {
	if (value.startsWith("http://") || value.startsWith("https://")) {
		try {
			const url = new URL(value)
			return url.pathname.replace(/^\/+/, "").replace(/\.git$/, "") || url.hostname
		} catch {
			return value
		}
	}
	if (value.startsWith("github.com/")) return value.replace(/^github\.com\//, "")
	return value.replace(/\.git$/, "")
}

function openExternalUrl(url: string) {
	void getPlatform().app.openExternalUrl(url)
}

const capabilityLabels: Record<string, string> = {
	"vault:read": "Read vault files",
	"vault:write": "Write vault files",
	"vault:delete": "Delete vault files",
	"vault:watch": "Watch vault changes",
	"editor:read": "Read active editor",
	"editor:write": "Write editor content",
	"editor:extensions": "Add editor extensions",
	"markdown:extensions": "Extend Markdown",
	"ui:views": "Show custom views",
	"ui:sidebar": "Add sidebar entries",
	"ui:statusbar": "Add status bar items",
	"ui:contextmenu": "Add context menu actions",
	"ui:modals": "Open modal views",
	"workspace:tabs": "Open workspace tabs",
	commands: "Register commands",
	settings: "Store settings",
	"theme:read": "Read active theme",
	"bookmarks:read": "Read bookmarks",
	"bookmarks:write": "Update bookmarks",
	"properties:types": "Add property types",
	data: "Store plugin data",
	notifications: "Send notifications",
}

function getCapabilityLabel(capability: string) {
	if (capabilityLabels[capability]) return capabilityLabels[capability]
	return capability
		.split(/[:_-]/)
		.filter(Boolean)
		.map((part, index) => (index === 0 ? part[0]?.toUpperCase() + part.slice(1) : part))
		.join(" ")
}

function formatManifestValue(value: string | null | undefined, loading: boolean) {
	if (value) return value
	return loading ? "Checking..." : "Not declared"
}

function MarketplaceDetailArtwork({ entry }: { entry: RegistryEntry }) {
	return (
		<div className="marketplace-detail-artwork marketplace-artwork flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-tertiary text-text-muted">
			{entry.coverImageUrl ? (
				<img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
			) : (
				<Package size={24} />
			)}
		</div>
	)
}

function MarketplaceMetadataItem({
	label,
	value,
	className = "",
}: {
	label: string
	value: string
	className?: string
}) {
	return (
		<div className={`marketplace-metadata-item ${className}`}>
			<span className="marketplace-metadata-label">{label}</span>
			<span className="marketplace-metadata-value">{value}</span>
		</div>
	)
}

function MarketplaceRepositoryItem({
	entry,
	repositoryUrl,
}: {
	entry: RegistryEntry
	repositoryUrl: string
}) {
	return (
		<div className="marketplace-metadata-item marketplace-metadata-repository">
			<span className="marketplace-metadata-label">Source</span>
			<button
				type="button"
				className="marketplace-repository-button"
				onClick={() => openExternalUrl(repositoryUrl)}
			>
				<span className="marketplace-repository-name">{entry.author}</span>
				<span className="marketplace-repository-path">
					{getRepositoryLabel(entry.repo)}
					<ExternalLink size={11} />
				</span>
			</button>
		</div>
	)
}

function MarketplaceCapabilities({
	capabilities,
	loading,
}: {
	capabilities: string[]
	loading: boolean
}) {
	const [open, setOpen] = useState(false)
	const hasCapabilities = capabilities.length > 0
	const summary = loading
		? "Checking permissions..."
		: hasCapabilities
			? `${capabilities.length} permission${capabilities.length === 1 ? "" : "s"} declared`
			: "No permissions declared"

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="marketplace-capabilities">
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="marketplace-capabilities-trigger"
					disabled={!hasCapabilities}
				>
					<span>
						<span className="marketplace-capabilities-title">Capabilities</span>
						<span className="marketplace-capabilities-summary">{summary}</span>
					</span>
					{hasCapabilities && (
						<ChevronDown className="marketplace-capabilities-chevron" size={14} />
					)}
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent className="marketplace-capabilities-content">
				<div className="marketplace-capabilities-content-inner">
					<div className="marketplace-capability-list">
						{capabilities.map((capability) => (
							<span key={capability} className="marketplace-capability-chip">
								{getCapabilityLabel(capability)}
							</span>
						))}
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

export function MarketplaceDetail({ tab, entry, hasVault, onBack }: MarketplaceDetailProps) {
	const {
		loadingEntryId,
		readmeCache,
		readmeLoading,
		appVersion,
		minVersionCache,
		manifestMetadataCache,
		manifestMetadataLoading,
		availableUpdates,
		installError,
	} = useMarketplaceStore()
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const uninstallEntry = useMarketplaceStore((state) => state.uninstallEntry)
	const readmeScrollRef = useRef<HTMLDivElement>(null)

	const isInstalled = entry ? isEntryInstalled(entry.id, tab) : false
	const isLoading = loadingEntryId === entry?.id
	const readme = entry ? readmeCache[entry.id] : undefined
	const manifestMetadata = entry ? manifestMetadataCache[entry.id] : undefined
	const isManifestLoading = entry ? Boolean(manifestMetadataLoading[entry.id]) : false
	const minVersion =
		manifestMetadata?.minAppVersion ?? (entry ? minVersionCache[entry.id] : undefined)
	const latestVersion = entry ? availableUpdates[entry.id] : undefined
	const hasUpdate = isInstalled && Boolean(latestVersion)
	const hasCompatibilityWarning =
		Boolean(minVersion) && Boolean(appVersion) && !isVersionCompatible(appVersion!, minVersion!)
	const authorUrl = entry?.authorUrl ? getExternalUrl(entry.authorUrl) : null
	const repositoryUrl = entry?.repo ? getRepositoryUrl(entry.repo) : null
	const readmeScrollKey = entry?.id ?? ""
	const manifestVersion = formatManifestValue(manifestMetadata?.version, isManifestLoading)
	const minimumAppVersion = formatManifestValue(minVersion, isManifestLoading)
	const capabilities = manifestMetadata?.capabilities ?? []

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
			<section className="marketplace-detail flex min-h-0 flex-col overflow-hidden">
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
		<section className="marketplace-detail flex min-h-0 flex-col overflow-hidden">
			<div className="marketplace-detail-header shrink-0 border-b border-border-subtle px-5 py-4">
				<Button
					variant="ghost"
					size="sm"
					className="marketplace-detail-back mb-3 gap-1.5"
					onClick={onBack}
				>
					<ArrowLeft size={14} />
					Back
				</Button>
				<div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex min-w-0 gap-4">
						<MarketplaceDetailArtwork entry={entry} />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<h2 className="m-0 truncate text-lg font-semibold leading-7 text-text-primary text-balance">
									{entry.name}
								</h2>
								{isInstalled && (
									<Badge variant={hasUpdate ? "secondary" : "outline"}>
										{hasUpdate ? "Update available" : "Installed"}
									</Badge>
								)}
							</div>
							<p className="m-0 max-w-[72ch] text-sm leading-6 text-text-muted text-pretty">
								{entry.description}
							</p>
							<div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
								<span>by {entry.author}</span>
								{authorUrl && (
									<Button
										variant="ghost"
										size="xs"
										className="gap-1 px-2"
										onClick={() => openExternalUrl(authorUrl)}
									>
										Author
										<ExternalLink size={11} />
									</Button>
								)}
							</div>
						</div>
					</div>
					<div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
						{!hasVault ? (
							<Button variant="secondary" size="sm" disabled>
								Open a vault to install
							</Button>
						) : isInstalled && hasUpdate ? (
							<>
								<Button size="sm" onClick={() => void installEntry(entry)} disabled={isLoading}>
									{isLoading ? <Spinner className="size-3" /> : <ArrowUp size={13} />}
									Update to {latestVersion}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => void uninstallEntry(entry)}
									disabled={isLoading}
									className="text-text-muted hover:text-destructive"
								>
									<Trash2 size={13} />
									Uninstall
								</Button>
							</>
						) : isInstalled ? (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => void uninstallEntry(entry)}
								disabled={isLoading}
							>
								{isLoading ? <Spinner className="size-3" /> : <Trash2 size={13} />}
								Uninstall
							</Button>
						) : (
							<Button size="sm" onClick={() => void installEntry(entry)} disabled={isLoading}>
								{isLoading ? <Spinner className="size-3" /> : <Download size={13} />}
								Install
							</Button>
						)}
					</div>
				</div>

				<div className="marketplace-detail-metadata">
					{repositoryUrl && (
						<MarketplaceRepositoryItem entry={entry} repositoryUrl={repositoryUrl} />
					)}
					<MarketplaceMetadataItem
						label={tab === "plugins" ? "Plugin version" : "Theme version"}
						value={manifestVersion}
					/>
					<MarketplaceMetadataItem label="Minimum Cortex" value={minimumAppVersion} />
				</div>

				{tab === "plugins" && (
					<MarketplaceCapabilities
						key={entry.id}
						capabilities={capabilities}
						loading={isManifestLoading && !manifestMetadata}
					/>
				)}

				{hasCompatibilityWarning && (
					<Alert variant="destructive" className="mt-4">
						<TriangleAlert size={14} />
						<AlertDescription>
							This {tab === "plugins" ? "plugin" : "theme"} requires Cortex v{minVersion} or later.
							You are running v{appVersion}.
						</AlertDescription>
					</Alert>
				)}

				{installError && (
					<Alert variant="destructive" className="mt-4">
						<TriangleAlert size={14} />
						<AlertDescription>{installError}</AlertDescription>
					</Alert>
				)}
			</div>

			<div ref={readmeScrollRef} className="min-h-0 flex-1 overflow-hidden">
				<ScrollArea key={entry.id} className="h-full">
					{readmeLoading && readme === undefined ? (
						<div className="flex flex-col gap-3 p-6">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-4/5" />
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-3/4" />
						</div>
					) : readme ? (
						<div className="marketplace-readme">
							<ReadingView content={readme} onExternalLinkClick={(url) => openExternalUrl(url)} />
						</div>
					) : (
						<Empty className="min-h-[320px] border-none">
							<EmptyDescription>No README available.</EmptyDescription>
						</Empty>
					)}
				</ScrollArea>
			</div>
		</section>
	)
}
