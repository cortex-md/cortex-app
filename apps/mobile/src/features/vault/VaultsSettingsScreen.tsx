import { getSyncServerLabel, useRemoteVaultStore, type VaultListItem } from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import { Stack } from "expo-router"
import { useMemo } from "react"
import { Platform, StyleSheet, View } from "react-native"

import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { presentSheet } from "@/features/navigation/routes"
import { impactCells, useVaultActions } from "@/features/vault/useVaultActions"
import { DEVICE_LABEL, useVaultListItems } from "@/features/vault/useVaultListItems"
import { VaultActionsMenu } from "@/features/vault/VaultActionsMenu"
import { useVaultAccess } from "@/features/vault/vaultAccess"
import { localVaultStatus, remoteVaultStatus } from "@/features/vault/vaultStatus"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function openAddVault(): void {
	presentSheet("add-vault")
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
	const entries = useMemo(() => localItems.map((item) => item.entry), [localItems])
	const access = useVaultAccess(entries)
	const remoteFor = (item: VaultListItem): RemoteVaultInfo | null =>
		remoteVaults.find((remote) => remote.id === item.remoteVaultId) ?? null

	return (
		<View style={styles.root}>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button icon="plus" onPress={openAddVault}>
						Add vault
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<NativeForm>
				<FormSection title={`On this ${DEVICE_LABEL}`}>
					{loading && localItems.length === 0 ? <FormRow disabled title="Loading…" /> : null}
					{localItems.map((item) => {
						const isCurrent = item.entry.uuid === actions.currentUuid
						const opening = actions.openingUuid === item.entry.uuid
						const remote = remoteFor(item)
						return (
							<VaultActionsMenu
								accessibilityLabel={`Actions for ${item.entry.name}`}
								color={item.color}
								groups={actions.localMenu(item, remote, access.get(item.entry.uuid))}
								key={item.entry.uuid}
								subtitle={localVaultStatus(item, remote, access.get(item.entry.uuid)).label}
								title={item.entry.name}
								value={opening ? "Opening…" : isCurrent ? "Open" : undefined}
							/>
						)
					})}
				</FormSection>
				{remoteOnly.length > 0 ? (
					<FormSection
						footer="Shared with you or created on another device."
						title="In your account"
					>
						{remoteOnly.map((remote) => (
							<VaultActionsMenu
								accessibilityLabel={`Actions for ${remote.name}`}
								color={String(colors.tertiaryLabel)}
								groups={actions.remoteMenu(remote)}
								key={remote.id}
								subtitle={remoteVaultStatus(remote, server).label}
								title={remote.name}
							/>
						))}
					</FormSection>
				) : null}
			</NativeForm>
			{IS_IOS ? null : (
				<View pointerEvents="box-none" style={styles.fab}>
					<FloatingActionButton
						icon={{ md: "add", sf: "plus" }}
						label="Add vault"
						onPress={openAddVault}
					/>
				</View>
			)}
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
	fab: {
		bottom: 24,
		position: "absolute",
		right: 16,
	},
	root: {
		flex: 1,
	},
})
