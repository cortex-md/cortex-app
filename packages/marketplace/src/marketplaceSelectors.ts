import type { ConfirmDialogOptions } from "@cortex/platform"
import { findBlockedEntry, isVersionBlocked } from "./catalogData"
import type { MarketplaceSortOrder, MarketplaceState, MarketplaceTab } from "./marketplaceStore"
import type {
	MarketplaceItemStats,
	MarketplaceKind,
	MarketplaceStats,
	RegistryEntry,
	VerifiedEntry,
} from "./types"
import { isVersionCompatible } from "./versionUtils"

type InstalledPredicate = (entryId: string) => boolean

export type MarketplaceEntryGroupKey = "updates" | "installed" | "available"

export interface MarketplaceEntryGroup {
	key: MarketplaceEntryGroupKey
	label: string
	entries: RegistryEntry[]
}

export type MarketplaceEntryAction = "install" | "update" | "uninstall"

export type MarketplaceBlockState = "none" | "item" | "versions"

export interface MarketplaceEntryState {
	action: MarketplaceEntryAction
	installed: boolean
	updateVersion: string | null
	minAppVersion: string | null
	incompatible: boolean
	verified: boolean
	stats: MarketplaceItemStats | null
	blockState: MarketplaceBlockState
	blockReason: string | null
	blockedVersions: string[]
	installBlocked: boolean
	blocklistUnavailable: boolean
}

export const marketplaceSortLabels: Record<MarketplaceSortOrder, string> = {
	default: "Curated",
	popular: "Most voted",
	downloads: "Most downloaded",
	newest: "Newest first",
	oldest: "Oldest first",
}

export function toMarketplaceKind(tab: MarketplaceTab): MarketplaceKind {
	return tab === "plugins" ? "plugin" : "theme"
}

export function getItemStats(
	stats: MarketplaceStats | null | undefined,
	tab: MarketplaceTab,
	entryId: string,
): MarketplaceItemStats | null {
	return stats?.[tab]?.[entryId] ?? null
}

export function isVerifiedEntry(
	verified: readonly VerifiedEntry[] | undefined,
	tab: MarketplaceTab,
	entryId: string,
): boolean {
	const kind = toMarketplaceKind(tab)
	return verified?.some((entry) => entry.kind === kind && entry.id === entryId) ?? false
}

export function getVoteUrl(
	stats: MarketplaceStats | null | undefined,
	tab: MarketplaceTab,
	entryId: string,
): string | null {
	return getItemStats(stats, tab, entryId)?.discussion?.url ?? null
}

export function formatCount(value: number | undefined): string {
	if (!value) return "0"
	if (value < 1000) return String(value)
	if (value < 1_000_000) return `${trimDecimal(value / 1000)}k`
	return `${trimDecimal(value / 1_000_000)}M`
}

export function formatStatsAge(
	generatedAt: string | null | undefined,
	now: number = Date.now(),
): string | null {
	if (!generatedAt) return null
	const minutes = Math.max(0, Math.round((now - new Date(generatedAt).getTime()) / 60_000))
	if (minutes < 1) return "Updated just now"
	if (minutes < 60) return `Updated ${minutes} min ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return `Updated ${hours} h ago`
	return `Updated ${Math.round(hours / 24)} d ago`
}

function trimDecimal(value: number): string {
	return value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "")
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

export function matchesEntry(entry: RegistryEntry, query: string): boolean {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return true
	return (
		entry.name.toLowerCase().includes(normalized) ||
		entry.author.toLowerCase().includes(normalized) ||
		entry.description.toLowerCase().includes(normalized) ||
		entry.repo.toLowerCase().includes(normalized)
	)
}

function getReleaseTime(releaseDates: Record<string, string>, entryId: string): number {
	const date = releaseDates[entryId]
	return date ? new Date(date).getTime() : 0
}

export function selectMarketplaceEntries(
	state: Pick<
		MarketplaceState,
		| "activeTab"
		| "pluginEntries"
		| "themeEntries"
		| "searchQuery"
		| "filterInstalled"
		| "sortOrder"
		| "releaseDates"
	> &
		Partial<Pick<MarketplaceState, "stats" | "blocked">>,
	{ isInstalled }: { isInstalled: InstalledPredicate },
): RegistryEntry[] {
	const allEntries = state.activeTab === "plugins" ? state.pluginEntries : state.themeEntries
	const kind = toMarketplaceKind(state.activeTab)
	const entries = allEntries.filter((entry) => {
		if (!matchesEntry(entry, state.searchQuery)) return false
		const installed = isInstalled(entry.id)
		if (state.filterInstalled && !installed) return false
		const block = findBlockedEntry(state.blocked ?? [], kind, entry.id)
		return installed || block?.versions !== null
	})

	switch (state.sortOrder) {
		case "default":
			return entries
		case "popular":
		case "downloads": {
			const field = state.sortOrder === "popular" ? "votes" : "downloads"
			return entries.sort(
				(a, b) =>
					(getItemStats(state.stats, state.activeTab, b.id)?.[field] ?? 0) -
						(getItemStats(state.stats, state.activeTab, a.id)?.[field] ?? 0) ||
					a.name.localeCompare(b.name),
			)
		}
		default: {
			const direction = state.sortOrder === "newest" ? -1 : 1
			return entries.sort(
				(a, b) =>
					direction *
					(getReleaseTime(state.releaseDates, a.id) - getReleaseTime(state.releaseDates, b.id)),
			)
		}
	}
}

export function groupMarketplaceEntries(
	entries: RegistryEntry[],
	{
		isInstalled,
		availableUpdates,
	}: { isInstalled: InstalledPredicate; availableUpdates: Record<string, string> },
): MarketplaceEntryGroup[] {
	const groups: MarketplaceEntryGroup[] = [
		{ key: "updates", label: "Updates", entries: [] },
		{ key: "installed", label: "Installed", entries: [] },
		{ key: "available", label: "Available", entries: [] },
	]
	const [updates, installed, available] = groups
	for (const entry of entries) {
		if (!isInstalled(entry.id)) available.entries.push(entry)
		else if (availableUpdates[entry.id]) updates.entries.push(entry)
		else installed.entries.push(entry)
	}
	return groups.filter((group) => group.entries.length > 0)
}

export function getMarketplaceEntryState(
	state: Pick<MarketplaceState, "availableUpdates" | "appVersion" | "manifestMetadataCache"> &
		Partial<
			Pick<
				MarketplaceState,
				"activeTab" | "stats" | "verified" | "blocked" | "blocklistAvailable" | "statsLoaded"
			>
		>,
	entryId: string,
	installed: boolean,
	kind?: MarketplaceTab,
): MarketplaceEntryState {
	const tab = kind ?? state.activeTab ?? "plugins"
	const updateVersion = installed ? (state.availableUpdates[entryId] ?? null) : null
	const minAppVersion = state.manifestMetadataCache[entryId]?.minAppVersion ?? null
	const stats = getItemStats(state.stats, tab, entryId)
	const block = findBlockedEntry(state.blocked ?? [], toMarketplaceKind(tab), entryId)
	const blockState: MarketplaceBlockState = !block
		? "none"
		: block.versions === null
			? "item"
			: "versions"
	const candidateVersion = state.manifestMetadataCache[entryId]?.version ?? stats?.latest ?? null
	const blocklistUnavailable = state.statsLoaded === true && state.blocklistAvailable === false

	return {
		action: updateVersion ? "update" : installed ? "uninstall" : "install",
		installed,
		updateVersion,
		minAppVersion,
		incompatible: Boolean(
			minAppVersion && state.appVersion && !isVersionCompatible(state.appVersion, minAppVersion),
		),
		verified: isVerifiedEntry(state.verified, tab, entryId),
		stats,
		blockState,
		blockReason: block?.reason ?? null,
		blockedVersions: block?.versions ?? [],
		installBlocked: blocklistUnavailable || isVersionBlocked(block, candidateVersion),
		blocklistUnavailable,
	}
}

export interface ThemeFamilyReference {
	name: string
	displayName?: string
}

export function findThemeFamily<Family extends ThemeFamilyReference>(
	entry: Pick<RegistryEntry, "id" | "name">,
	families: readonly Family[],
): Family | null {
	const candidates = new Set([entry.id.toLowerCase(), entry.name.toLowerCase()])
	return (
		families.find(
			(family) =>
				candidates.has(family.name.toLowerCase()) ||
				(family.displayName !== undefined && candidates.has(family.displayName.toLowerCase())),
		) ?? null
	)
}

export function getCapabilityLabel(capability: string): string {
	if (capabilityLabels[capability]) return capabilityLabels[capability]
	return capability
		.split(/[:_-]/)
		.filter(Boolean)
		.map((part, index) => (index === 0 ? part[0]?.toUpperCase() + part.slice(1) : part))
		.join(" ")
}

export function formatManifestValue(value: string | null | undefined, loading: boolean): string {
	if (value) return value
	return loading ? "Checking..." : "Not declared"
}

function isHttpUrl(value: string): boolean {
	return value.startsWith("http://") || value.startsWith("https://")
}

export function getExternalUrl(value: string): string {
	return isHttpUrl(value) ? value : `https://${value}`
}

export function getRepositoryUrl(repo: string): string {
	if (isHttpUrl(repo)) return repo
	if (repo.startsWith("github.com/")) return `https://${repo}`
	return `https://github.com/${repo}`
}

export function getRepositoryLabel(repo: string): string {
	if (isHttpUrl(repo)) {
		try {
			const url = new URL(repo)
			return url.pathname.replace(/^\/+/, "").replace(/\.git$/, "") || url.hostname
		} catch {
			return repo
		}
	}
	if (repo.startsWith("github.com/")) return repo.replace(/^github\.com\//, "")
	return repo.replace(/\.git$/, "")
}

export const COMMUNITY_PLUGINS_WARNING =
	"Community plugins run with full access to your vault and to Cortex. Only enable plugins you trust."

export const ALLOW_COMMUNITY_PLUGINS_CONFIRMATION: ConfirmDialogOptions = {
	title: "Turn on community plugins?",
	message: `${COMMUNITY_PLUGINS_WARNING} Community plugins are never enabled automatically.`,
	confirmLabel: "Turn on",
}

export function getPluginEnableConfirmation(manifest: {
	name: string
	permissions?: readonly string[]
}): ConfirmDialogOptions {
	const permissions = manifest.permissions ?? []
	const declared =
		permissions.length > 0
			? `It declares these permissions:\n${permissions.map((permission) => `• ${getCapabilityLabel(permission)}`).join("\n")}`
			: "It declares no permissions."
	return {
		title: `Enable ${manifest.name}?`,
		message: `${declared}\n\n${COMMUNITY_PLUGINS_WARNING}`,
		confirmLabel: "Enable",
	}
}
