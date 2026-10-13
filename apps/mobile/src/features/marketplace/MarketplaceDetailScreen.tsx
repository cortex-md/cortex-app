import { getErrorMessage, useVaultStore } from "@cortex/core"
import {
	findThemeFamily,
	formatManifestValue,
	getCapabilityLabel,
	getMarketplaceEntryState,
	getRepositoryUrl,
	type MarketplaceTab,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect } from "react"

import { EmptyState } from "@/components/ui/EmptyState"
import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { mobilePluginHost } from "@/bootstrap/pluginHost"
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

function PluginPrimaryRow({
	entry,
	hasVault,
	incompatible,
	installed,
	updateVersion,
}: {
	entry: RegistryEntry
	hasVault: boolean
	incompatible: boolean
	installed: boolean
	updateVersion: string | null
}) {
	const allowCommunity = useCommunityPluginsAllowed()
	const busy = useMarketplaceStore((state) => state.loadingEntryId === entry.id)
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const install = () => void installEntry(entry, "plugins")

	if (!hasVault) return <FormRow disabled title="Open a vault to install" />
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

	useEffect(() => {
		if (entry) void loadManifestMetadata(entry)
	}, [entry, loadManifestMetadata])

	if (!entry) return <EmptyState title="Plugin not found" />

	const installed = Boolean(record)
	const entryState = getMarketplaceEntryState(
		{ appVersion, availableUpdates, manifestMetadataCache },
		entry.id,
		installed,
	)
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
						installed={installed}
						updateVersion={entryState.updateVersion}
					/>
				</FormSection>
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
					<FormRow chevron onPress={() => openMarketplaceReadme(entry.id)} title="README" />
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
	updateVersion,
}: {
	entry: RegistryEntry
	familyName: string | null
	hasVault: boolean
	incompatible: boolean
	updateVersion: string | null
}) {
	const selectedTheme = useSettingsStore((state) => state.settings.appearance.theme)
	const busy = useMarketplaceStore((state) => state.loadingEntryId === entry.id)
	const installEntry = useMarketplaceStore((state) => state.installEntry)
	const install = () => void installEntry(entry, "themes")

	if (!hasVault) return <FormRow disabled title="Open a vault to install" />
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

	useEffect(() => {
		if (entry) void loadManifestMetadata(entry)
	}, [entry, loadManifestMetadata])

	if (!entry) return <EmptyState title="Theme not found" />

	const familyName = findThemeFamily(entry, families)?.name ?? null
	const entryState = getMarketplaceEntryState(
		{ appVersion, availableUpdates, manifestMetadataCache },
		entry.id,
		familyName !== null,
	)
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
						updateVersion={entryState.updateVersion}
					/>
				</FormSection>
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
					<FormRow chevron onPress={() => openMarketplaceReadme(entry.id)} title="README" />
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
