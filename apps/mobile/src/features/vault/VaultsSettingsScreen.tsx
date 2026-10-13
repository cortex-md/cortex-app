import { getSyncServerLabel, useRemoteVaultStore, type VaultListItem } from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import { Plus } from "lucide-react-native"
import { type ReactNode, useMemo, useState } from "react"
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { GroupedFooter, GroupedList, GroupedSectionHeader } from "@/components/ui/GroupedList"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { presentSheet } from "@/features/navigation/routes"
import { SettingsIntro, SettingsScroll } from "@/features/settings/SettingsLayout"
import { impactCells, useVaultActions } from "@/features/vault/useVaultActions"
import { DEVICE_LABEL, useVaultListItems } from "@/features/vault/useVaultListItems"
import { VaultActionsMenu } from "@/features/vault/VaultActionsMenu"
import {
	localVaultStatus,
	remoteVaultStatus,
	toneColor,
	type VaultStatusLine,
} from "@/features/vault/vaultStatus"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function openAddVault(): void {
	presentSheet("add-vault")
}

function VaultRow({
	color,
	groups,
	menuLabel,
	name,
	status,
	trailing,
}: {
	color: string
	groups: MenuGroup[]
	menuLabel: string
	name: string
	status: VaultStatusLine
	trailing?: ReactNode
}) {
	const { colors } = useMobileColors()
	const [presented, setPresented] = useState(false)
	const StatusIcon = status.Icon
	const statusColor = toneColor(status.tone, colors)
	return (
		<View style={styles.row}>
			<View style={[styles.dot, { backgroundColor: color }]} />
			<Pressable
				accessibilityLabel={`${name}, ${status.label}`}
				accessibilityRole="button"
				onPress={() => setPresented(true)}
				style={styles.rowBody}
			>
				<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
					{name}
				</Text>
				<View style={styles.statusLine}>
					<StatusIcon color={statusColor} size={14} strokeWidth={2.2} />
					<Text numberOfLines={1} style={[styles.status, { color: statusColor }]}>
						{status.label}
					</Text>
				</View>
			</Pressable>
			{trailing}
			<VaultActionsMenu
				accessibilityLabel={menuLabel}
				groups={groups}
				message={status.label}
				onPresentedChange={setPresented}
				presented={presented}
				title={name}
			/>
		</View>
	)
}

function OpenButton({ label, onPress }: { label: string; onPress: () => void }) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.openButton,
				IS_IOS ? { backgroundColor: colors.fill } : null,
				{ opacity: pressed ? 0.6 : 1 },
			]}
		>
			<Text style={[styles.openLabel, { color: colors.tint }]}>{label}</Text>
		</Pressable>
	)
}

export function VaultsSettingsScreen() {
	const { colors } = useMobileColors()
	const { items, loading, refresh, remoteOnly } = useVaultListItems()
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const server = getSyncServerLabel(syncConfig)
	const actions = useVaultActions(refresh, server)
	const localItems = useMemo(
		() => items.filter((item) => !actions.hidden.has(item.entry.uuid)),
		[actions.hidden, items],
	)
	const remoteFor = (item: VaultListItem): RemoteVaultInfo | null =>
		remoteVaults.find((remote) => remote.id === item.remoteVaultId) ?? null

	return (
		<View style={styles.root}>
			<SettingsScroll>
				<SettingsIntro>{`Vaults on this ${DEVICE_LABEL} and the ones in your account.`}</SettingsIntro>
				<GroupedSectionHeader
					trailing={
						IS_IOS ? (
							<Text onPress={openAddVault} style={[styles.headerAction, { color: colors.tint }]}>
								Add a vault…
							</Text>
						) : undefined
					}
				>
					{`On this ${DEVICE_LABEL}`}
				</GroupedSectionHeader>
				{loading && localItems.length === 0 ? (
					<ActivityIndicator color={colors.tint} style={styles.spinner} />
				) : (
					<GroupedList>
						{localItems.map((item) => {
							const isCurrent = item.entry.uuid === actions.currentUuid
							const opening = actions.openingUuid === item.entry.uuid
							const canOpen = !isCurrent && item.status !== "missing"
							return (
								<VaultRow
									color={item.color}
									groups={actions.localMenu(item, remoteFor(item))}
									key={item.entry.uuid}
									menuLabel={`More for ${item.entry.name}`}
									name={item.entry.name}
									status={localVaultStatus(item, remoteFor(item))}
									trailing={
										isCurrent ? (
											<Badge label="Open now" tint />
										) : canOpen ? (
											<OpenButton
												label={opening ? "Opening…" : "Open"}
												onPress={() => void actions.open(item)}
											/>
										) : null
									}
								/>
							)
						})}
					</GroupedList>
				)}

				{remoteOnly.length > 0 ? (
					<>
						<GroupedSectionHeader>{`In your account, not on this ${DEVICE_LABEL}`}</GroupedSectionHeader>
						<GroupedList>
							{remoteOnly.map((remote) => (
								<VaultRow
									color={colors.tertiaryLabel}
									groups={actions.remoteMenu(remote)}
									key={remote.id}
									menuLabel={`More for ${remote.name}`}
									name={remote.name}
									status={remoteVaultStatus(remote, server)}
									trailing={
										<OpenButton
											label="Download…"
											onPress={() =>
												presentSheet("add-vault", { remoteVaultId: remote.id, start: "download" })
											}
										/>
									}
								/>
							))}
						</GroupedList>
						<GroupedFooter>Shared with you or created on another device.</GroupedFooter>
					</>
				) : null}
				{!IS_IOS ? <View style={styles.fabSpacer} /> : null}
			</SettingsScroll>
			{!IS_IOS ? (
				<View pointerEvents="box-none" style={styles.fab}>
					<FloatingActionButton Icon={Plus} label="Add a vault" onPress={openAddVault} sf="plus" />
				</View>
			) : null}
			<ConfirmDialog
				confirmLabel={actions.pending?.impact.confirmLabel ?? ""}
				destructive={actions.pending?.impact.destructive ?? false}
				impact={actions.pending ? impactCells(actions.pending.impact) : undefined}
				message={actions.pending?.impact.description}
				onCancel={actions.cancelPending}
				onConfirm={() => void actions.runPending()}
				title={actions.pending?.impact.title ?? ""}
				typedName={actions.pending?.impact.confirmName}
				visible={actions.pending !== null}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	dot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	fab: {
		bottom: 24,
		position: "absolute",
		right: 16,
	},
	fabSpacer: {
		height: 88,
	},
	headerAction: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	openButton: {
		alignItems: "center",
		borderRadius: 999,
		justifyContent: "center",
		minHeight: IS_IOS ? 30 : 40,
		paddingHorizontal: 12,
	},
	openLabel: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "600",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: 20,
	},
	root: {
		flex: 1,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 60 : 72,
		paddingLeft: 16,
		paddingRight: 6,
		paddingVertical: 8,
	},
	rowBody: {
		flex: 1,
		gap: 3,
		minWidth: 0,
	},
	spinner: {
		marginVertical: 24,
	},
	status: {
		flexShrink: 1,
		fontSize: IS_IOS ? 13 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: IS_IOS ? 18 : 20,
	},
	statusLine: {
		alignItems: "center",
		flexDirection: "row",
		gap: 5,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
	},
})
