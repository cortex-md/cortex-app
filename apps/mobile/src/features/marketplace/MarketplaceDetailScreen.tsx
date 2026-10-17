import { getErrorMessage, useVaultStore } from "@cortex/core"
import {
	BLOCKLIST_UNAVAILABLE_MESSAGE,
	findThemeFamily,
	formatCount,
	formatManifestValue,
	formatStatsAge,
	getCapabilityLabel,
	getMarketplaceEntryState,
	getRepositoryUrl,
	getVoteUrl,
	type MarketplaceEntryState,
	type MarketplaceTab,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect } from "react"
import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { EmptyState } from "@/components/ui/EmptyState"
import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import {
	addTemplate,
	applyCommunityTheme,
	findTemplate,
	isTemplateInVault,
	openTemplate,
	useMarketplaceExtras,
} from "@/features/marketplace/marketplaceAdapter"
import type { MarketplaceTemplate } from "@/features/marketplace/marketplaceFixtures"
import {
	type MarketplaceEntryKind,
	openExternalUrl,
	openMarketplaceReadme,
} from "@/features/marketplace/marketplaceNavigation"
import {
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import { useThemeFamilies } from "@/features/themes/communityThemes"

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

function formatReleaseDate(value: string | undefined): string | null {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

async function confirmUninstall(entry: RegistryEntry, kind: MarketplaceTab): Promise<void> {
	const confirmed = await getPlatform().dialog.showConfirm({
		title: `Uninstall ${entry.name}?`,
		message: `The ${kind === "plugins" ? "plugin" : "theme"} files are removed from this vault.`,
		destructive: true,
		confirmLabel: "Uninstall",
	})
	if (confirmed) await useMarketplaceStore.getState().uninstallEntry(entry, kind)
}

async function disablePlugin(pluginId: string): Promise<void> {
	try {
		await mobilePluginHost.disablePlugin(pluginId)
		await mobilePluginHost.saveEnabledPlugins()
		toast("Disabled in this vault")
	} catch (cause) {
		toast(getErrorMessage(cause))
	}
}

function useCommunityData() {
	const stats = useMarketplaceStore((state) => state.stats)
	const verified = useMarketplaceStore((state) => state.verified)
	const blocked = useMarketplaceStore((state) => state.blocked)
	const blocklistAvailable = useMarketplaceStore((state) => state.blocklistAvailable)
	const statsLoaded = useMarketplaceStore((state) => state.statsLoaded)
	return { stats, verified, blocked, blocklistAvailable, statsLoaded }
}

function ReviewSection({
	entryState,
	kind,
}: {
	entryState: MarketplaceEntryState
	kind: MarketplaceTab
}) {
	const label = kind === "plugins" ? "plugin" : "theme"
	const audit = entryState.stats?.audit
	if (entryState.blocklistUnavailable) {
		return (
			<FormSection footer={BLOCKLIST_UNAVAILABLE_MESSAGE} title="Review">
				<FormRow disabled title="Installs and updates are paused" />
			</FormSection>
		)
	}
	if (entryState.blockState === "item") {
		return (
			<FormSection footer={entryState.blockReason ?? undefined} title="Review">
				<FormRow destructive title={`This ${label} was removed from the Marketplace`} />
			</FormSection>
		)
	}
	if (entryState.blockState === "versions") {
		return (
			<FormSection footer={entryState.blockReason ?? undefined} title="Review">
				<FormRow
					destructive
					title={`Version ${entryState.blockedVersions.join(", ")} was pulled`}
				/>
			</FormSection>
		)
	}
	if (audit && audit.status !== "pass") {
		return (
			<FormSection footer={audit.issues.slice(0, 3).join("\n")} title="Review">
				<FormRow
					destructive={audit.status === "fail"}
					title={
						audit.status === "fail"
							? `Automated review flagged ${audit.checkedTag}`
							: `Automated review found warnings in ${audit.checkedTag}`
					}
				/>
			</FormSection>
		)
	}
	return null
}

function CommunitySection({
	entryState,
	voteUrl,
}: {
	entryState: MarketplaceEntryState
	voteUrl: string | null
}) {
	const generatedAt = useMarketplaceStore((state) => state.stats.generatedAt)
	const stats = entryState.stats
	if (!stats && !entryState.verified) return null
	return (
		<FormSection footer={formatStatsAge(generatedAt) ?? undefined} title="Community">
			{entryState.verified ? <FormRow title="Verified by Cortex" /> : null}
			{stats ? <FormRow title="Votes" value={formatCount(stats.votes)} /> : null}
			{stats ? <FormRow title="Downloads" value={formatCount(stats.downloads)} /> : null}
			{stats ? <FormRow title="GitHub stars" value={formatCount(stats.stars)} /> : null}
			{voteUrl ? (
				<FormRow
					chevron
					onPress={() => void openExternalUrl(voteUrl)}
					tint
					title="Vote on GitHub"
				/>
			) : null}
		</FormSection>
	)
}

function PluginPrimaryRow({
	entry,
	hasVault,
	incompatible,
	installBlocked,
	installed,
	updateVersion,
}: {
	entry: RegistryEntry
	hasVault: boolean
	incompatible: boolean
	installBlocked: boolean
	installed: boolean
	updateVersion: string | null
}) {
	const allowCommunity = useCommunityPluginsAllowed()
	const busy = useMarketplaceStore((state) => state.loadingEntryId === entry.id)
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const install = () => void installEntry(entry, "plugins")

	if (!hasVault) return <FormRow disabled title="Open a vault to install" />
	if (installBlocked && (updateVersion || !installed))
		return <FormRow disabled title="Not available" />
	if (!allowCommunity && !installed) {
		return (
			<FormRow
				onPress={() => void setCommunityPluginsAllowed(true)}
				tint
				title="Allow community plugins to install"
			/>
		)
	}
	if (updateVersion) {
		return (
			<FormRow
				disabled={busy}
				onPress={install}
				tint
				title={busy ? "Updating…" : `Update to ${updateVersion}`}
			/>
		)
	}
	if (installed) return null
	return (
		<FormRow
			disabled={busy || incompatible}
			onPress={install}
			tint
			title={busy ? "Installing…" : "Install"}
		/>
	)
}

function PluginDetail({ id }: { id: string }) {
	const entry = useMarketplaceStore((state) => state.pluginEntries.find((item) => item.id === id))
	const record = usePluginStore((state) => state.plugins[id])
	const hasVault = useVaultStore((state) => Boolean(state.vault))
	const appVersion = useMarketplaceStore((state) => state.appVersion)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const releaseDates = useMarketplaceStore((state) => state.releaseDates)
	const manifestMetadataCache = useMarketplaceStore((state) => state.manifestMetadataCache)
	const manifestLoading = useMarketplaceStore((state) => Boolean(state.manifestMetadataLoading[id]))
	const loadManifestMetadata = useMarketplaceStore((state) => state.loadManifestMetadata)
	const community = useCommunityData()

	useEffect(() => {
		if (entry) void loadManifestMetadata(entry)
	}, [entry, loadManifestMetadata])

	if (!entry) return <EmptyState title="Plugin not found" />

	const installed = Boolean(record)
	const entryState = getMarketplaceEntryState(
		{ appVersion, availableUpdates, manifestMetadataCache, ...community },
		entry.id,
		installed,
		"plugins",
	)
	const voteUrl = getVoteUrl(community.stats, "plugins", entry.id)
	const metadata = manifestMetadataCache[entry.id]
	const capabilities = metadata?.capabilities ?? []
	const released = formatReleaseDate(releaseDates[entry.id])
	const requires = entryState.minAppVersion
		? `Cortex ${entryState.minAppVersion}+`
		: formatManifestValue(null, manifestLoading)

	return (
		<>
			<Stack.Screen options={{ title: entry.name }} />
			<NativeForm>
				<FormSection
					footer={
						entryState.incompatible
							? `Requires Cortex ${entryState.minAppVersion}+. This device runs ${appVersion}.`
							: undefined
					}
				>
					<FormRow subtitle={entry.author} title={entry.description} />
					<PluginPrimaryRow
						entry={entry}
						hasVault={hasVault}
						incompatible={entryState.incompatible}
						installBlocked={entryState.installBlocked}
						installed={installed}
						updateVersion={entryState.updateVersion}
					/>
				</FormSection>
				<ReviewSection entryState={entryState} kind="plugins" />
				<CommunitySection entryState={entryState} voteUrl={voteUrl} />
				<FormSection title="Information">
					<FormRow
						title="Version"
						value={
							record?.manifest.version ?? formatManifestValue(metadata?.version, manifestLoading)
						}
					/>
					{released ? <FormRow title="Released" value={released} /> : null}
					<FormRow title="Requires" value={requires} />
					<FormRow
						chevron
						onPress={() => void openExternalUrl(getRepositoryUrl(entry.repo))}
						title="Source"
						value="GitHub"
					/>
					<FormRow
						chevron
						onPress={() => openMarketplaceReadme(entry.id)}
						title={entry.screenshots?.length ? "README and screenshots" : "README"}
					/>
				</FormSection>
				<FormSection footer="Permissions apply to this vault only." title="Permissions">
					{capabilities.length > 0 ? (
						capabilities.map((capability) => (
							<FormRow key={capability} title={getCapabilityLabel(capability)} />
						))
					) : (
						<FormRow
							disabled
							title={
								manifestLoading && !metadata ? "Checking permissions…" : "No permissions declared"
							}
						/>
					)}
				</FormSection>
				{installed ? (
					<FormSection>
						{record?.status === "enabled" ? (
							<FormRow onPress={() => void disablePlugin(entry.id)} title="Disable in this vault" />
						) : null}
						<FormRow
							destructive
							onPress={() => void confirmUninstall(entry, "plugins")}
							title="Uninstall"
						/>
					</FormSection>
				) : null}
			</NativeForm>
		</>
	)
}

function ThemePrimaryRow({
	entry,
	familyName,
	hasVault,
	incompatible,
	installBlocked,
	updateVersion,
}: {
	entry: RegistryEntry
	familyName: string | null
	hasVault: boolean
	incompatible: boolean
	installBlocked: boolean
	updateVersion: string | null
}) {
	const selectedTheme = useSettingsStore((state) => state.settings.appearance.theme)
	const busy = useMarketplaceStore((state) => state.loadingEntryId === entry.id)
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const install = () => void installEntry(entry, "themes")

	if (!hasVault) return <FormRow disabled title="Open a vault to install" />
	if (installBlocked && (updateVersion || !familyName))
		return <FormRow disabled title="Not available" />
	if (updateVersion) {
		return (
			<FormRow
				disabled={busy}
				onPress={install}
				tint
				title={busy ? "Updating…" : `Update to ${updateVersion}`}
			/>
		)
	}
	if (familyName) {
		return familyName === selectedTheme ? (
			<FormRow disabled title="In use" />
		) : (
			<FormRow onPress={() => applyCommunityTheme(familyName)} tint title="Use theme" />
		)
	}
	return (
		<FormRow
			disabled={busy || incompatible}
			onPress={install}
			tint
			title={busy ? "Installing…" : "Install"}
		/>
	)
}

function ThemeDetail({ id }: { id: string }) {
	const entry = useMarketplaceStore((state) => state.themeEntries.find((item) => item.id === id))
	const families = useThemeFamilies()
	const hasVault = useVaultStore((state) => Boolean(state.vault))
	const appVersion = useMarketplaceStore((state) => state.appVersion)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const releaseDates = useMarketplaceStore((state) => state.releaseDates)
	const manifestMetadataCache = useMarketplaceStore((state) => state.manifestMetadataCache)
	const manifestLoading = useMarketplaceStore((state) => Boolean(state.manifestMetadataLoading[id]))
	const loadManifestMetadata = useMarketplaceStore((state) => state.loadManifestMetadata)
	const community = useCommunityData()

	useEffect(() => {
		if (entry) void loadManifestMetadata(entry)
	}, [entry, loadManifestMetadata])

	if (!entry) return <EmptyState title="Theme not found" />

	const familyName = findThemeFamily(entry, families)?.name ?? null
	const entryState = getMarketplaceEntryState(
		{ appVersion, availableUpdates, manifestMetadataCache, ...community },
		entry.id,
		familyName !== null,
		"themes",
	)
	const voteUrl = getVoteUrl(community.stats, "themes", entry.id)
	const metadata = manifestMetadataCache[entry.id]
	const released = formatReleaseDate(releaseDates[entry.id])
	const requires = entryState.minAppVersion
		? `Cortex ${entryState.minAppVersion}+`
		: formatManifestValue(null, manifestLoading)

	return (
		<>
			<Stack.Screen options={{ title: entry.name }} />
			<NativeForm>
				<FormSection
					footer={
						entryState.incompatible
							? `Requires Cortex ${entryState.minAppVersion}+. This device runs ${appVersion}.`
							: undefined
					}
				>
					<FormRow subtitle={entry.author} title={entry.description} />
					<ThemePrimaryRow
						entry={entry}
						familyName={familyName}
						hasVault={hasVault}
						incompatible={entryState.incompatible}
						installBlocked={entryState.installBlocked}
						updateVersion={entryState.updateVersion}
					/>
				</FormSection>
				<ReviewSection entryState={entryState} kind="themes" />
				<CommunitySection entryState={entryState} voteUrl={voteUrl} />
				<FormSection title="Information">
					<FormRow
						title="Version"
						value={formatManifestValue(metadata?.version, manifestLoading)}
					/>
					{released ? <FormRow title="Released" value={released} /> : null}
					<FormRow title="Requires" value={requires} />
					<FormRow
						chevron
						onPress={() => void openExternalUrl(getRepositoryUrl(entry.repo))}
						title="Source"
						value="GitHub"
					/>
					<FormRow
						chevron
						onPress={() => openMarketplaceReadme(entry.id)}
						title={entry.screenshots?.length ? "README and screenshots" : "README"}
					/>
				</FormSection>
				{familyName ? (
					<FormSection>
						<FormRow
							destructive
							onPress={() => void confirmUninstall(entry, "themes")}
							title="Uninstall"
						/>
					</FormSection>
				) : null}
			</NativeForm>
		</>
	)
}

function TemplateDetail({ template }: { template: MarketplaceTemplate }) {
	const extras = useMarketplaceExtras()
	const inVault = isTemplateInVault(extras, template)
	const kindLabel = template.isDatabase ? "Database" : "Note"

	return (
		<>
			<Stack.Screen options={{ title: template.name }} />
			<NativeForm>
				<FormSection>
					<FormRow subtitle={`${template.author} · ${kindLabel} template`} title={template.lead} />
					{template.group === "team" ? (
						<FormRow onPress={() => openTemplate(template)} tint title="Use template" />
					) : inVault ? (
						<FormRow
							onPress={() => openTemplate(template)}
							tint
							title="Open"
							value={`In ${template.destination ?? "Templates"}`}
						/>
					) : (
						<FormRow onPress={() => addTemplate(template)} tint title="Add to vault" />
					)}
				</FormSection>
				<FormSection title="Preview">
					{template.preview.map(([name, value]) => (
						<FormRow key={name} title={name} value={value} />
					))}
				</FormSection>
				<FormSection footer="Adds Markdown files to your vault. No code runs." title="What’s added">
					{template.files.map((file) => (
						<FormRow key={file} title={file} />
					))}
				</FormSection>
				<FormSection title="Information">
					<FormRow title="Version" value={template.version} />
					<FormRow title="Updated" value={template.updated} />
					<FormRow title="Includes" value={template.includes} />
					<FormRow title="Source" value={template.source} />
				</FormSection>
			</NativeForm>
		</>
	)
}

export function MarketplaceDetailScreen() {
	const params = useLocalSearchParams<{ id?: string | string[]; kind?: string | string[] }>()
	const id = readParam(params.id) ?? ""
	const kind = (readParam(params.kind) ?? "plugin") as MarketplaceEntryKind

	if (kind === "theme") return <ThemeDetail id={id} />
	if (kind === "template") {
		const template = findTemplate(id)
		return template ? (
			<TemplateDetail template={template} />
		) : (
			<EmptyState title="Template not found" />
		)
	}
	return <PluginDetail id={id} />
}
