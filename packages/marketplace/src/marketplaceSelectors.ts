import type { ConfirmDialogOptions } from "@cortex/platform"
import type { MarketplaceSortOrder, MarketplaceState } from "./marketplaceStore"
import type { RegistryEntry } from "./types"
import { isVersionCompatible } from "./versionUtils"

type InstalledPredicate = (entryId: string) => boolean

export type MarketplaceEntryGroupKey = "updates" | "installed" | "available"

export interface MarketplaceEntryGroup {
	key: MarketplaceEntryGroupKey
	label: string
	entries: RegistryEntry[]
}

export type MarketplaceEntryAction = "install" | "update" | "uninstall"

export interface MarketplaceEntryState {
	action: MarketplaceEntryAction
	installed: boolean
	updateVersion: string | null
	minAppVersion: string | null
	incompatible: boolean
}

export const marketplaceSortLabels: Record<MarketplaceSortOrder, string> = {
	default: "Curated",
	newest: "Newest first",
	oldest: "Oldest first",
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
	>,
	{ isInstalled }: { isInstalled: InstalledPredicate },
): RegistryEntry[] {
	const allEntries = state.activeTab === "plugins" ? state.pluginEntries : state.themeEntries
	const entries = allEntries.filter(
		(entry) =>
			matchesEntry(entry, state.searchQuery) && (!state.filterInstalled || isInstalled(entry.id)),
	)
	if (state.sortOrder === "default") return entries
	const direction = state.sortOrder === "newest" ? -1 : 1
	return entries.sort(
		(a, b) =>
			direction *
			(getReleaseTime(state.releaseDates, a.id) - getReleaseTime(state.releaseDates, b.id)),
	)
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
	state: Pick<MarketplaceState, "availableUpdates" | "appVersion" | "manifestMetadataCache">,
	entryId: string,
	installed: boolean,
): MarketplaceEntryState {
	const updateVersion = installed ? (state.availableUpdates[entryId] ?? null) : null
	const minAppVersion = state.manifestMetadataCache[entryId]?.minAppVersion ?? null
	return {
		action: updateVersion ? "update" : installed ? "uninstall" : "install",
		installed,
		updateVersion,
		minAppVersion,
		incompatible: Boolean(
			minAppVersion && state.appVersion && !isVersionCompatible(state.appVersion, minAppVersion),
		),
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
