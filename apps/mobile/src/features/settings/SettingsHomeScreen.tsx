import { useAuthStore, useRemoteVaultStore, useVaultStore } from "@cortex/core"
import { useMarketplaceStore } from "@cortex/marketplace"
import { useSettingsStore } from "@cortex/settings"
import { Stack } from "expo-router"
import { useMemo, useState } from "react"
import { Platform, SectionList, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { accountServerLabel, useAccountServer } from "@/features/account/accountServer"
import { useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { openSettings, presentSheet, type SettingsPage } from "@/features/navigation/routes"
import { ListCell, ListSectionHeader, listCellStyles } from "@/features/search/ListCell"
import { COLOR_SCHEME_LABELS } from "@/features/settings/appearanceOptions"
import {
	CORTEX_SETTINGS_LINKS,
	EXTENSION_SETTINGS_LINKS,
	type SettingsLink,
	SYNC_SETTINGS_LINKS,
} from "@/features/settings/settingsPages"
import { useMobileColors } from "@/hooks/useMobileColors"

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
			appearance: COLOR_SCHEME_LABELS[colorscheme],
			marketplace: updates > 0 ? `${updates} update${updates === 1 ? "" : "s"}` : undefined,
			members: linked?.memberCount ? String(linked.memberCount) : undefined,
			overview: !linkedVaultId ? "Off" : syncConfig.enabled ? "On" : "Paused",
			vaults: vaultName,
		}
	}, [availableUpdates, colorscheme, linkedVaultId, remoteVaults, syncConfig.enabled, vaultName])
}

interface SettingsItem {
	key: string
	title: string
	subtitle?: string
	value?: string
	icon?: SymbolName
	page: SettingsPage
	onPress?: () => void
	tint?: boolean
	account?: boolean
}

interface SettingsSection {
	key: string
	title?: string
	data: SettingsItem[]
}

function filterLinks(links: SettingsLink[], query: string): SettingsLink[] {
	return query ? links.filter((link) => link.title.toLowerCase().includes(query)) : links
}

function linkSection(
	title: string,
	links: SettingsLink[],
	values: Record<string, string | undefined>,
): SettingsSection[] {
	if (links.length === 0) return []
	return [
		{
			data: links.map((link) => ({
				icon: IS_IOS ? undefined : link.icon,
				key: link.key,
				page: link.page,
				title: link.title,
				value: values[link.key],
			})),
			key: title,
			title,
		},
	]
}

function SettingsItemRow({
	first,
	item,
	last,
}: {
	first: boolean
	item: SettingsItem
	last: boolean
}) {
	const { colors } = useMobileColors()
	return (
		<ListCell
			first={first}
			last={last}
			onPress={item.onPress ?? (() => openSettings(item.page))}
			separatorInset={item.icon && IS_IOS ? 68 : 16}
		>
			{item.icon ? (
				<SymbolIcon
					color={item.account ? colors.tint : colors.secondaryLabel}
					name={item.icon}
					size={item.account ? 40 : IS_IOS ? 22 : 24}
				/>
			) : null}
			<View style={listCellStyles.body}>
				<Text
					numberOfLines={1}
					style={[
						listCellStyles.title,
						item.account ? styles.accountTitle : null,
						{ color: item.tint ? colors.tint : colors.label },
					]}
				>
					{item.title}
				</Text>
				{item.subtitle ? (
					<Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondaryLabel }]}>
						{item.subtitle}
					</Text>
				) : null}
			</View>
			{item.value ? (
				<Text numberOfLines={1} style={[listCellStyles.value, { color: colors.secondaryLabel }]}>
					{item.value}
				</Text>
			) : null}
			{IS_IOS ? (
				<SymbolIcon
					color={colors.tertiaryLabel}
					name={{ md: "chevron_right", sf: "chevron.right" }}
					size={13}
				/>
			) : null}
		</ListCell>
	)
}

export function SettingsHomeScreen() {
	const { colors } = useMobileColors()
	const user = useAuthStore((state) => (state.authenticated ? state.user : null))
	const server = useAccountServer()
	const { planLabel } = useHostedSyncEntitlement()
	const values = useSettingsValues()
	const accountSubtitle = user
		? `${user.email} · ${server.selfHosted ? accountServerLabel(server) : planLabel}`
		: "Sync your vaults across devices"

	const [query, setQuery] = useState("")
	const normalized = query.trim().toLowerCase()
	const signInItem: SettingsItem = {
		key: "sign-in",
		onPress: () => presentSheet("sign-in"),
		page: "account",
		tint: true,
		title: "Sign in to sync",
	}
	const syncSection: SettingsSection[] = user
		? linkSection("Sync", filterLinks(SYNC_SETTINGS_LINKS, normalized), values)
		: normalized && !signInItem.title.toLowerCase().includes(normalized)
			? []
			: [{ data: [signInItem], key: "Sync", title: "Sync" }]

	const sections: SettingsSection[] = [
		...(normalized
			? []
			: [
					{
						data: [
							{
								account: true,
								icon: { md: "account_circle", sf: "person.crop.circle.fill" },
								key: "account",
								page: "account",
								subtitle: accountSubtitle,
								title: user ? (user.displayName ?? user.email) : "Account",
							} satisfies SettingsItem,
						],
						key: "account",
					},
				]),
		...linkSection("Cortex", filterLinks(CORTEX_SETTINGS_LINKS, normalized), values),
		...syncSection,
		...linkSection("Extensions", filterLinks(EXTENSION_SETTINGS_LINKS, normalized), values),
	]

	return (
		<>
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(item) => item.key}
				ListEmptyComponent={
					<EmptyState
						icon={{ md: "search_off", sf: "magnifyingglass" }}
						title={`No settings match “${query.trim()}”`}
					/>
				}
				renderItem={({ index, item, section }) => (
					<SettingsItemRow
						first={index === 0}
						item={item}
						last={index === section.data.length - 1}
					/>
				)}
				renderSectionHeader={({ section }) =>
					section.title ? (
						<ListSectionHeader>{section.title}</ListSectionHeader>
					) : (
						<View style={styles.spacer} />
					)
				}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				onCancelButtonPress={() => setQuery("")}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder="Search settings"
			/>
		</>
	)
}

const styles = StyleSheet.create({
	accountTitle: {
		fontSize: IS_IOS ? 20 : 18,
		fontWeight: "600",
		lineHeight: IS_IOS ? 25 : 24,
	},
	content: {
		paddingBottom: 32,
	},
	spacer: {
		height: 20,
	},
	subtitle: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
})
