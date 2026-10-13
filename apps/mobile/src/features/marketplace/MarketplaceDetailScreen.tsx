import { getErrorMessage, useVaultStore } from "@cortex/core"
import {
	formatManifestValue,
	getCapabilityLabel,
	getMarketplaceEntryState,
	getRepositoryLabel,
	getRepositoryUrl,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { FieldGroup, Text as NativeText } from "@expo/ui"
import { Stack, useLocalSearchParams } from "expo-router"
import { Database, EllipsisVertical, FileText, Lock, Palette, ShieldCheck } from "lucide-react-native"
import { type ReactNode, useEffect, useState } from "react"
import { Image, Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { toast } from "@/features/feedback/useToast"
import {
	addTemplate,
	applyTheme,
	findTemplate,
	findTheme,
	installTheme,
	isTemplateInVault,
	isThemeInstalled,
	openTemplate,
	useMarketplaceExtras,
} from "@/features/marketplace/marketplaceAdapter"
import type { MarketplaceTemplate, MarketplaceTheme } from "@/features/marketplace/marketplaceFixtures"
import {
	type MarketplaceEntryKind,
	openExternalUrl,
	openMarketplaceReadme,
} from "@/features/marketplace/marketplaceNavigation"
import { openSettings } from "@/features/navigation/routes"
import {
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import {
	ActionButton,
	SettingsBlock,
	SettingsFooterText,
	SettingsGroup,
} from "@/features/sync/SettingsPage"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" })
const HERO_ICON_SIZE = 72

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

function DetailPage({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "" }} />
			{children}
		</ScrollView>
	)
}

function Hero({
	actions,
	icon,
	meta,
	name,
}: {
	actions: ReactNode
	icon: ReactNode
	meta: string
	name: string
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.hero}>
			{icon}
			<View style={styles.heroText}>
				<Text style={[styles.heroName, { color: colors.label }]}>{name}</Text>
				<Text style={[styles.heroMeta, { color: colors.secondaryLabel }]}>{meta}</Text>
				<View style={styles.heroActions}>{actions}</View>
			</View>
		</View>
	)
}

function HeroIcon({ children }: { children: ReactNode }) {
	const { colors } = useMobileColors()
	return <View style={[styles.heroIcon, { backgroundColor: colors.accentSubtle }]}>{children}</View>
}

function Description({ children }: { children: string }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.description, { color: colors.label }]}>{children}</Text>
}

async function confirmUninstall(entry: RegistryEntry): Promise<void> {
	const confirmed = await getPlatform().dialog.showConfirm({
		title: "Uninstall",
		message: `Are you sure you want to uninstall "${entry.name}"?`,
		destructive: true,
		confirmLabel: "Uninstall",
	})
	if (confirmed) await useMarketplaceStore.getState().uninstallEntry(entry)
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

function PluginPrimaryAction({
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
	const install = () => void installEntry(entry)

	if (!hasVault) return <ActionButton disabled label="Open a vault to install" onPress={() => {}} />
	if (!allowCommunity && !installed) {
		return (
			<ActionButton
				label="Allow community plugins to install"
				onPress={() => void setCommunityPluginsAllowed(true)}
			/>
		)
	}
	if (updateVersion) {
		return (
			<ActionButton
				disabled={busy}
				label={busy ? "Updating…" : `Update to ${updateVersion}`}
				onPress={install}
			/>
		)
	}
	if (installed) return <ActionButton label="Open" onPress={() => openSettings("plugins")} />
	return (
		<ActionButton disabled={busy || incompatible} label={busy ? "Installing…" : "Install"} onPress={install} />
	)
}

function PluginDetail({ id }: { id: string }) {
	const { colors } = useMobileColors()
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
	const installedVersion = record?.manifest.version
	const meta = installedVersion ? `${entry.author} · Installed ${installedVersion}` : entry.author
	const released = formatReleaseDate(releaseDates[entry.id])

	return (
		<DetailPage>
			<Hero
				actions={
					<>
						<PluginPrimaryAction
							entry={entry}
							hasVault={hasVault}
							incompatible={entryState.incompatible}
							installed={installed}
							updateVersion={entryState.updateVersion}
						/>
						{installed ? (
							<NativeMenu
								accessibilityLabel="More actions"
								anchorStyle="glass"
								groups={[
									[
										{
											key: "disable",
											label: "Disable in this vault",
											onPress: () => void disablePlugin(entry.id),
										},
									],
									[
										{
											key: "uninstall",
											label: "Uninstall",
											destructive: true,
											onPress: () => void confirmUninstall(entry),
										},
									],
								]}
								icon={{ sf: "ellipsis", Lucide: EllipsisVertical }}
							/>
						) : null}
					</>
				}
				icon={
					entry.coverImageUrl ? (
						<Image source={{ uri: entry.coverImageUrl }} style={[styles.heroIcon, { backgroundColor: colors.fill }]} />
					) : (
						<HeroIcon>
							<Text style={[styles.heroInitial, { color: colors.tint }]}>
								{entry.name.charAt(0).toUpperCase()}
							</Text>
						</HeroIcon>
					)
				}
				meta={meta}
				name={entry.name}
			/>
			<Description>{entry.description}</Description>
			{entryState.incompatible ? (
				<SettingsFooterText>
					{`Requires Cortex ${entryState.minAppVersion}+. You are running ${appVersion}.`}
				</SettingsFooterText>
			) : null}
			<SettingsGroup>
				<FieldGroup.Section title="Information">
					<SettingsRow title="Version" value={formatManifestValue(metadata?.version, manifestLoading)} />
					{released ? <SettingsRow title="Released" value={released} /> : null}
					<SettingsRow
						title="Requires"
						value={entryState.minAppVersion ? `Cortex ${entryState.minAppVersion}+` : formatManifestValue(null, manifestLoading)}
					/>
					<SettingsRow title="Scope" value="This vault" />
					<SettingsRow
						chevron
						onPress={() => void openExternalUrl(getRepositoryUrl(entry.repo))}
						subtitle={IS_IOS ? undefined : getRepositoryLabel(entry.repo)}
						title="Source"
						value="GitHub"
					/>
					<SettingsRow chevron onPress={() => openMarketplaceReadme(entry.id)} title="README" />
				</FieldGroup.Section>
				<FieldGroup.Section title="Permissions">
					{capabilities.length > 0 ? (
						capabilities.map((capability) => (
							<SettingsRow key={capability} title={getCapabilityLabel(capability)} />
						))
					) : (
						<SettingsRow
							title={manifestLoading && !metadata ? "Checking permissions…" : "No permissions declared"}
						/>
					)}
					<FieldGroup.SectionFooter>
						<NativeText textStyle={{ color: colors.secondaryLabel }}>
							Permissions apply to this vault only.
						</NativeText>
					</FieldGroup.SectionFooter>
				</FieldGroup.Section>
			</SettingsGroup>
		</DetailPage>
	)
}

function ThemePreviewCard({ dark, subtitle, title }: { dark: boolean; subtitle: string; title: string }) {
	const { colors } = useMobileColors()
	return (
		<View
			style={[
				styles.previewCard,
				{
					backgroundColor: dark ? colors.inverseSurface : colors.elevated,
					borderColor: colors.borderSubtle,
				},
			]}
		>
			<Text style={[styles.previewHeading, { color: dark ? colors.inverseOnSurface : colors.label }]}>
				{title}
			</Text>
			<Text style={[styles.previewBody, { color: dark ? colors.inverseOnSurface : colors.secondaryLabel }]}>
				{subtitle}
			</Text>
			<View style={[styles.previewAccent, { backgroundColor: colors.tintFill }]} />
		</View>
	)
}

function ThemeDetail({ theme }: { theme: MarketplaceTheme }) {
	const { colors, themeName } = useMobileColors()
	const extras = useMarketplaceExtras()
	const installed = isThemeInstalled(extras, theme)
	const inUse = theme.builtIn && theme.id === themeName

	return (
		<DetailPage>
			<Hero
				actions={null}
				icon={
					<HeroIcon>
						<Palette color={colors.tint} size={34} strokeWidth={2} />
					</HeroIcon>
				}
				meta={theme.meta}
				name={theme.name}
			/>
			<View style={styles.wideAction}>
				{inUse ? (
					<ActionButton disabled label="In use" onPress={() => {}} wide />
				) : installed ? (
					<ActionButton label="Use theme" onPress={() => applyTheme(theme)} wide />
				) : (
					<ActionButton label="Install" onPress={() => installTheme(theme)} wide />
				)}
			</View>
			<Description>{theme.description}</Description>
			<View style={styles.previews}>
				<ThemePreviewCard dark={false} subtitle="Headings in a book serif" title="Light" />
				<ThemePreviewCard dark subtitle="Same tones, low light" title="Dark" />
			</View>
			<SettingsFooterText>
				Overrides documented colour and font variables only. Body text keeps the editor font from
				Appearance.
			</SettingsFooterText>
			<SettingsGroup>
				<FieldGroup.Section title="Information">
					<SettingsRow title="Version" value={theme.version} />
					<SettingsRow title="Modes" value={theme.modes} />
					<SettingsRow title="Requires" value="Cortex 0.1.0+" />
					<SettingsRow title="Source" value={theme.source} />
				</FieldGroup.Section>
			</SettingsGroup>
		</DetailPage>
	)
}

type TemplateTab = "preview" | "files"

const TEMPLATE_TABS: { label: string; value: TemplateTab }[] = [
	{ label: "Preview", value: "preview" },
	{ label: "What’s added", value: "files" },
]

function TemplateDetail({ template }: { template: MarketplaceTemplate }) {
	const { colors } = useMobileColors()
	const extras = useMarketplaceExtras()
	const [tab, setTab] = useState<TemplateTab>("preview")
	const inVault = isTemplateInVault(extras, template)
	const Icon = template.isDatabase ? Database : FileText
	const kindLabel = template.isDatabase ? "Database" : "Note"

	const actions =
		template.group === "team" ? (
			<ActionButton label="Use template" onPress={() => openTemplate(template)} />
		) : inVault ? (
			<View style={styles.inDest}>
				<Text style={[styles.inDestText, { color: colors.secondaryLabel }]}>
					{`In ${template.destination ?? "Templates"}`}
				</Text>
				<ActionButton label="Open" onPress={() => openTemplate(template)} />
			</View>
		) : (
			<ActionButton label="Add to vault" onPress={() => addTemplate(template)} />
		)

	return (
		<DetailPage>
			<Hero
				actions={actions}
				icon={
					<HeroIcon>
						<Icon color={colors.tint} size={34} strokeWidth={2} />
					</HeroIcon>
				}
				meta={`${template.author} · ${kindLabel} template`}
				name={template.name}
			/>
			<Description>{template.lead}</Description>
			<SegmentedControl
				accessibilityLabel="Template details"
				onChange={setTab}
				options={TEMPLATE_TABS}
				style={styles.segmented}
				value={tab}
			/>
			<View style={styles.tabBody}>
				<GroupedList>
					{tab === "preview"
						? template.preview.map(([name, value]) => (
								<GroupedRow key={name} title={name} value={value} />
							))
						: template.files.map((file) => (
								<View key={file} style={styles.fileRow}>
									<Text style={[styles.filePath, { color: colors.label }]}>{file}</Text>
								</View>
							))}
				</GroupedList>
			</View>
			<SettingsGroup>
				<FieldGroup.Section title="Template information">
					<SettingsRow title="Version" value={template.version} />
					<SettingsRow title="Updated" value={template.updated} />
					<SettingsRow title="Includes" value={template.includes} />
					<SettingsRow title="Source" value={template.source} />
				</FieldGroup.Section>
			</SettingsGroup>
			<SettingsBlock title="Safety">
				<GroupedList>
					<GroupedRow
						leading={
							IS_IOS ? (
								<Lock color={colors.secondaryLabel} size={22} strokeWidth={2} />
							) : (
								<ShieldCheck color={colors.secondaryLabel} size={24} strokeWidth={2} />
							)
						}
						subtitle="Adds files to your vault. No code runs."
						title="Markdown only"
					/>
				</GroupedList>
			</SettingsBlock>
		</DetailPage>
	)
}

export function MarketplaceDetailScreen() {
	const params = useLocalSearchParams<{ id?: string | string[]; kind?: string | string[] }>()
	const id = readParam(params.id) ?? ""
	const kind = (readParam(params.kind) ?? "plugin") as MarketplaceEntryKind

	if (kind === "theme") {
		const theme = findTheme(id)
		return theme ? <ThemeDetail theme={theme} /> : <EmptyState title="Theme not found" />
	}
	if (kind === "template") {
		const template = findTemplate(id)
		return template ? <TemplateDetail template={template} /> : <EmptyState title="Template not found" />
	}
	return <PluginDetail id={id} />
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 48,
	},
	description: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
		marginHorizontal: 20,
		marginTop: 16,
	},
	filePath: {
		fontFamily: MONO_FONT,
		fontSize: 13,
		lineHeight: 18,
	},
	fileRow: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	hero: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 16,
		marginHorizontal: 20,
		marginTop: 8,
	},
	heroActions: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		marginTop: 10,
	},
	heroIcon: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 18,
		height: HERO_ICON_SIZE,
		justifyContent: "center",
		overflow: "hidden",
		width: HERO_ICON_SIZE,
	},
	heroInitial: {
		fontSize: 30,
		fontWeight: "700",
	},
	heroMeta: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: 2,
	},
	heroName: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 28,
	},
	heroText: {
		flex: 1,
		minWidth: 0,
	},
	inDest: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
	},
	inDestText: {
		fontSize: 15,
		lineHeight: 20,
	},
	previewAccent: {
		borderRadius: 999,
		height: 4,
		marginTop: 10,
		width: 36,
	},
	previewBody: {
		fontSize: 12,
		lineHeight: 16,
		marginTop: 2,
	},
	previewCard: {
		borderCurve: "continuous",
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		flex: 1,
		padding: 14,
	},
	previewHeading: {
		fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	previews: {
		flexDirection: "row",
		gap: 10,
		marginHorizontal: 16,
		marginTop: 16,
	},
	segmented: {
		marginHorizontal: 16,
		marginTop: 16,
	},
	tabBody: {
		marginTop: 12,
	},
	wideAction: {
		marginHorizontal: 20,
		marginTop: 16,
	},
})
