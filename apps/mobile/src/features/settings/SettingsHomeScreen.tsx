import { useRemoteVaultStore, useVaultStore } from "@cortex/core"
import { useMarketplaceStore } from "@cortex/marketplace"
import { useSettingsStore } from "@cortex/settings"
import { Stack } from "expo-router"
import { useMemo, useState } from "react"
import { Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { useAccountSummary, useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { openSettings } from "@/features/navigation/routes"
import { SCHEME_LABELS, settingToScheme } from "@/features/settings/appearanceOptions"
import {
	CORTEX_SETTINGS_LINKS,
	EXTENSION_SETTINGS_LINKS,
	type SettingsLink,
	SYNC_SETTINGS_LINKS,
} from "@/features/settings/settingsPages"

const IS_IOS = Platform.OS === "ios"

function useSettingsValues(): Record<string, string | undefined> {
	const vaultName = useVaultStore((state) => state.vault?.name)
	const colorscheme = useSettingsStore((state) => state.settings.appearance.colorscheme)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	return useMemo(() => {
		const linked = remoteVaults.find((remote) => remote.id === linkedVaultId)
		const updates = Object.keys(availableUpdates).length
		return {
			appearance: SCHEME_LABELS[settingToScheme[colorscheme]],
			marketplace: updates > 0 ? `${updates} update${updates === 1 ? "" : "s"}` : undefined,
			members: linked?.memberCount ? String(linked.memberCount) : undefined,
			overview: !linkedVaultId ? "Off" : syncConfig.enabled ? "On" : "Paused",
			"self-hosted": syncConfig.selfHosted ? "On" : "Off",
			vaults: vaultName,
		}
	}, [
		availableUpdates,
		colorscheme,
		linkedVaultId,
		remoteVaults,
		syncConfig.enabled,
		syncConfig.selfHosted,
		vaultName,
	])
}

function filterLinks(links: SettingsLink[], query: string): SettingsLink[] {
	return query ? links.filter((link) => link.title.toLowerCase().includes(query)) : links
}

function linkSection(
	title: string,
	links: SettingsLink[],
	values: Record<string, string | undefined>,
) {
	if (links.length === 0) return null
	return (
		<FormSection key={title} title={title}>
			{links.map((link) => (
				<FormRow
					chevron
					icon={IS_IOS ? undefined : link.icon}
					key={link.key}
					onPress={() => openSettings(link.page)}
					title={link.title}
					value={values[link.key]}
				/>
			))}
		</FormSection>
	)
}

export function SettingsHomeScreen() {
	const account = useAccountSummary()
	const { planLabel } = useHostedSyncEntitlement()
	const values = useSettingsValues()
	const [query, setQuery] = useState("")
	const normalized = query.trim().toLowerCase()
	const cortex = filterLinks(CORTEX_SETTINGS_LINKS, normalized)
	const sync = filterLinks(SYNC_SETTINGS_LINKS, normalized)
	const extensions = filterLinks(EXTENSION_SETTINGS_LINKS, normalized)
	const empty = cortex.length + sync.length + extensions.length === 0

	return (
		<>
			<Stack.SearchBar
				autoCapitalize="none"
				hideWhenScrolling={false}
				onCancelButtonPress={() => setQuery("")}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder="Search settings"
			/>
			<NativeForm>
				{!normalized ? (
					<FormSection>
						<FormRow
							chevron
							icon={{ sf: "person.crop.circle.fill", md: "account_circle" }}
							onPress={() => openSettings("general")}
							subtitle={`${account.email} · ${planLabel}`}
							title={account.displayName}
						/>
					</FormSection>
				) : null}
				{linkSection("Cortex", cortex, values)}
				{linkSection("Sync", sync, values)}
				{linkSection("Extensions", extensions, values)}
				{empty ? (
					<FormSection>
						<FormRow disabled title={`No settings match “${query.trim()}”`} />
					</FormSection>
				) : null}
			</NativeForm>
		</>
	)
}
