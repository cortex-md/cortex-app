import { useVaultStore } from "@cortex/core"
import {
	formatManifestValue,
	getCapabilityLabel,
	getExternalUrl,
	getMarketplaceEntryState,
	getRepositoryLabel,
	getRepositoryUrl,
	type MarketplaceEntryState,
	type RegistryEntry,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { FieldGroup, Host, ListItem, Text } from "@expo/ui"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect } from "react"
import { StyleSheet } from "react-native"

import {
	openExternalUrl,
	openMarketplaceReadme,
} from "@/features/marketplace/marketplaceNavigation"
import {
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import { useMobileColors } from "@/hooks/useMobileColors"

async function confirmUninstall(entry: RegistryEntry): Promise<void> {
	const confirmed = await getPlatform().dialog.showConfirm({
		title: "Uninstall",
		message: `Are you sure you want to uninstall "${entry.name}"?`,
		destructive: true,
		confirmLabel: "Uninstall",
	})
	if (confirmed) await useMarketplaceStore.getState().uninstallEntry(entry)
}

function installEntry(entry: RegistryEntry): void {
	void useMarketplaceStore.getState().installEntry(entry)
}

function MarketplaceActions({
	entry,
	entryState,
	hasVault,
	loading,
}: {
	entry: RegistryEntry
	entryState: MarketplaceEntryState
	hasVault: boolean
	loading: boolean
}) {
	const allowCommunity = useCommunityPluginsAllowed()
	if (!hasVault) return <ListItem>Open a vault to install</ListItem>
	if (loading) return <ListItem>Working...</ListItem>
	return (
		<>
			{!allowCommunity && !entryState.installed ? (
				<ListItem
					onPress={() => void setCommunityPluginsAllowed(true)}
					supportingText="Community plugins are turned off."
				>
					Allow community plugins to install
				</ListItem>
			) : null}
			{allowCommunity && entryState.action === "install" ? (
				<ListItem onPress={() => installEntry(entry)}>Install</ListItem>
			) : null}
			{allowCommunity && entryState.updateVersion ? (
				<ListItem onPress={() => installEntry(entry)}>
					{`Update to ${entryState.updateVersion}`}
				</ListItem>
			) : null}
			{entryState.installed ? (
				<ListItem onPress={() => void confirmUninstall(entry)}>Uninstall</ListItem>
			) : null}
		</>
	)
}

export function MarketplaceDetailScreen() {
	const { id = "" } = useLocalSearchParams<{ id?: string }>()
	const { colors } = useMobileColors()
	const entry = useMarketplaceStore((state) => state.pluginEntries.find((item) => item.id === id))
	const installed = usePluginStore((state) => id in state.plugins)
	const hasVault = useVaultStore((state) => Boolean(state.vault))
	const loadingEntryId = useMarketplaceStore((state) => state.loadingEntryId)
	const appVersion = useMarketplaceStore((state) => state.appVersion)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	const manifestMetadataCache = useMarketplaceStore((state) => state.manifestMetadataCache)
	const manifestLoading = useMarketplaceStore((state) => Boolean(state.manifestMetadataLoading[id]))
	const loadManifestMetadata = useMarketplaceStore((state) => state.loadManifestMetadata)

	useEffect(() => {
		if (entry) void loadManifestMetadata(entry)
	}, [entry, loadManifestMetadata])

	if (!entry) {
		return (
			<Host style={[styles.host, { backgroundColor: colors.background }]}>
				<FieldGroup>
					<FieldGroup.Section>
						<ListItem>Plugin not found</ListItem>
					</FieldGroup.Section>
				</FieldGroup>
			</Host>
		)
	}

	const entryState = getMarketplaceEntryState(
		{ appVersion, availableUpdates, manifestMetadataCache },
		entry.id,
		installed,
	)
	const metadata = manifestMetadataCache[entry.id]
	const capabilities = metadata?.capabilities ?? []
	const authorUrl = entry.authorUrl ? getExternalUrl(entry.authorUrl) : null

	return (
		<>
			<Stack.Screen options={{ title: entry.name }} />
			<Host style={[styles.host, { backgroundColor: colors.background }]}>
				<FieldGroup>
					<FieldGroup.Section>
						<ListItem supportingText={entry.description}>{entry.name}</ListItem>
						<MarketplaceActions
							entry={entry}
							entryState={entryState}
							hasVault={hasVault}
							loading={loadingEntryId === entry.id}
						/>
						{entryState.incompatible ? (
							<FieldGroup.SectionFooter>
								<Text>
									{`Requires Cortex v${entryState.minAppVersion} or later. You are running v${appVersion}.`}
								</Text>
							</FieldGroup.SectionFooter>
						) : null}
					</FieldGroup.Section>
					<FieldGroup.Section title="Information">
						<ListItem
							onPress={authorUrl ? () => void openExternalUrl(authorUrl) : undefined}
							supportingText={entry.author}
						>
							Author
						</ListItem>
						<ListItem supportingText={formatManifestValue(metadata?.version, manifestLoading)}>
							Plugin version
						</ListItem>
						<ListItem
							supportingText={formatManifestValue(entryState.minAppVersion, manifestLoading)}
						>
							Minimum Cortex
						</ListItem>
						<ListItem
							onPress={() => void openExternalUrl(getRepositoryUrl(entry.repo))}
							supportingText={getRepositoryLabel(entry.repo)}
						>
							Source
						</ListItem>
						<ListItem onPress={() => openMarketplaceReadme(entry.id)}>README</ListItem>
					</FieldGroup.Section>
					<FieldGroup.Section title="Permissions">
						{capabilities.length > 0 ? (
							capabilities.map((capability) => (
								<ListItem key={capability}>{getCapabilityLabel(capability)}</ListItem>
							))
						) : (
							<ListItem>
								{manifestLoading && !metadata
									? "Checking permissions..."
									: "No permissions declared"}
							</ListItem>
						)}
						{capabilities.length > 0 ? (
							<FieldGroup.SectionFooter>
								<Text>Permissions apply to this vault only.</Text>
							</FieldGroup.SectionFooter>
						) : null}
					</FieldGroup.Section>
				</FieldGroup>
			</Host>
		</>
	)
}

const styles = StyleSheet.create({
	host: {
		flex: 1,
	},
})
