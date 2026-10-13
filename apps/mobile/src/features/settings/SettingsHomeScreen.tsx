import { useRemoteVaultStore, useVaultStore } from "@cortex/core"
import { useMarketplaceStore } from "@cortex/marketplace"
import { Stack } from "expo-router"
import { ChevronRight, Search } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { SearchField } from "@/components/ui/SearchField"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { useAccountSummary, useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { openSettings } from "@/features/navigation/routes"
import { SettingsScroll, SettingsSection } from "@/features/settings/SettingsLayout"
import {
	CORTEX_SETTINGS_LINKS,
	EXTENSION_SETTINGS_LINKS,
	type SettingsLink,
	SYNC_SETTINGS_LINKS,
} from "@/features/settings/settingsPages"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function useSettingsValues(): Record<string, string | undefined> {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const availableUpdates = useMarketplaceStore((state) => state.availableUpdates)
	return useMemo(() => {
		const linked = remoteVaults.find((remote) => remote.id === linkedVaultId)
		const updates = Object.keys(availableUpdates).length
		return {
			members: linked?.memberCount ? String(linked.memberCount) : undefined,
			marketplace: updates > 0 ? `${updates} update${updates === 1 ? "" : "s"}` : undefined,
			overview: !linkedVaultId ? "Off" : syncConfig.enabled ? "Synced" : "Paused",
			"self-hosted": syncConfig.selfHosted ? "On" : "Off",
		}
	}, [availableUpdates, linkedVaultId, remoteVaults, syncConfig.enabled, syncConfig.selfHosted])
}

function matches(link: SettingsLink, query: string): boolean {
	return !query || link.title.toLowerCase().includes(query)
}

function SettingsLinks({
	links,
	query,
	title,
	values,
}: {
	links: SettingsLink[]
	query: string
	title: string
	values: Record<string, string | undefined>
}) {
	const visible = links.filter((link) => matches(link, query))
	if (visible.length === 0) return null
	return (
		<SettingsSection title={title}>
			{visible.map((link) => (
				<SettingsRow
					chevron
					Icon={IS_IOS ? undefined : link.Icon}
					key={link.key}
					onPress={() => openSettings(link.page)}
					title={link.title}
					value={values[link.key]}
				/>
			))}
		</SettingsSection>
	)
}

function AccountCard() {
	const { colors } = useMobileColors()
	const account = useAccountSummary()
	const { planLabel } = useHostedSyncEntitlement()
	return (
		<Pressable
			accessibilityLabel={`${account.displayName}, ${account.email}, ${planLabel}`}
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={() => openSettings("general")}
			style={({ pressed }) => [
				styles.account,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : colors.cell },
			]}
		>
			<Avatar name={account.displayName} size={36} />
			<View style={styles.accountBody}>
				<Text numberOfLines={1} style={[styles.accountName, { color: colors.label }]}>
					{account.displayName}
				</Text>
				<Text numberOfLines={1} style={[styles.accountMeta, { color: colors.secondaryLabel }]}>
					{`${account.email} · ${planLabel}`}
				</Text>
			</View>
			<ChevronRight color={colors.tertiaryLabel} size={IS_IOS ? 14 : 24} strokeWidth={2.4} />
		</Pressable>
	)
}

export function SettingsHomeScreen() {
	const vaultName = useVaultStore((state) => state.vault?.name ?? "Vault")
	const values = useSettingsValues()
	const [query, setQuery] = useState("")
	const [searching, setSearching] = useState(IS_IOS)
	const normalized = query.trim().toLowerCase()

	return (
		<>
			{!IS_IOS ? (
				<Stack.Screen
					options={{
						headerRight: () => (
							<HeaderIconButton
								accessibilityLabel="Search settings"
								Icon={Search}
								onPress={() => {
									setSearching((value) => !value)
									setQuery("")
								}}
							/>
						),
					}}
				/>
			) : null}
			<SettingsScroll>
				{searching ? (
					<View style={styles.search}>
						<SearchField
							accessibilityLabel="Search settings"
							autoFocus={!IS_IOS}
							onChangeText={setQuery}
							onClear={() => setQuery("")}
							placeholder="Search settings"
							value={query}
						/>
					</View>
				) : null}
				{!normalized ? <AccountCard /> : null}
				<SettingsLinks links={CORTEX_SETTINGS_LINKS} query={normalized} title="Cortex" values={values} />
				<SettingsLinks
					links={SYNC_SETTINGS_LINKS}
					query={normalized}
					title={`Sync · ${vaultName}`}
					values={values}
				/>
				<SettingsLinks
					links={EXTENSION_SETTINGS_LINKS}
					query={normalized}
					title="Extensions"
					values={values}
				/>
			</SettingsScroll>
		</>
	)
}

const styles = StyleSheet.create({
	account: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		gap: 12,
		marginHorizontal: 16,
		marginTop: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	accountBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	accountMeta: {
		fontSize: IS_IOS ? 13 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: IS_IOS ? 18 : 20,
	},
	accountName: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		letterSpacing: IS_IOS ? 0 : 0.15,
		lineHeight: IS_IOS ? 22 : 24,
	},
	search: {
		marginTop: IS_IOS ? 4 : 0,
	},
})
