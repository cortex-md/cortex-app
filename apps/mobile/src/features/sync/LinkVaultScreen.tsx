import {
	formatLastSyncedAt,
	useDevicesStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { type Href, router, Stack } from "expo-router"
import { useEffect } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import {
	listSyncDevices,
	resolveLinkedRemoteVault,
	unlinkRemoteVault,
} from "@/features/sync/syncAdapter"
import { DEVICE_LABEL } from "@/features/sync/syncTypes"

export const LINK_VAULT_CHOOSE_HREF = "/settings/sync/choose" as Href

export function LinkVaultScreen() {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSyncEnabled = useRemoteVaultStore((state) => state.setSyncEnabled)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const deviceEntries = useDevicesStore((state) => state.deviceEntries)

	useEffect(() => {
		void useDevicesStore.getState().fetchDevices()
		void useRemoteVaultStore.getState().fetchRemoteVaults()
	}, [])

	const linked = resolveLinkedRemoteVault(remoteVaults, linkedVaultId, syncConfig)
	const enabled = syncConfig.enabled
	const devices = listSyncDevices(deviceEntries, lastSyncedAt)
	const chooseRemote = () => router.push(LINK_VAULT_CHOOSE_HREF)

	const confirmUnlink = () => {
		if (!linked) return
		Alert.alert(
			"Stop syncing?",
			`Notes stay on this ${DEVICE_LABEL} as a local vault. ${linked.name} stays on ${linked.serverLabel} and other devices keep syncing.`,
			[
				{ style: "cancel", text: "Cancel" },
				{
					onPress: () => {
						if (vaultPath) void unlinkRemoteVault(vaultPath)
					},
					style: "destructive",
					text: "Stop syncing",
				},
			],
		)
	}

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "Remote vault" }} />
			{linked ? (
				<NativeForm>
					<FormSection>
						<FormToggle
							onValueChange={(value) => {
								if (vaultPath) void setSyncEnabled(vaultPath, value)
							}}
							title="Sync this vault"
							value={enabled}
						/>
					</FormSection>
					<FormSection title="Linked to">
						<FormRow
							icon={{ sf: "icloud", md: "cloud" }}
							subtitle={`${linked.serverLabel} · ${linked.role}`}
							title={linked.name}
						/>
						<FormRow
							title="Last synced"
							value={enabled ? formatLastSyncedAt(lastSyncedAt) : "Paused"}
						/>
						<FormRow title="Devices" value={String(devices.length)} />
						<FormRow chevron onPress={chooseRemote} tint title="Change remote vault" />
					</FormSection>
					<FormSection>
						<FormRow
							destructive
							icon={{ sf: "icloud.slash", md: "cloud_off" }}
							onPress={confirmUnlink}
							title="Stop syncing"
						/>
					</FormSection>
				</NativeForm>
			) : (
				<NativeForm>
					<FormSection
						footer={`This vault is only on this ${DEVICE_LABEL}. Link a remote vault to keep it the same on every device.`}
					>
						<FormRow
							chevron
							icon={{ sf: "link.icloud", md: "cloud_upload" }}
							onPress={chooseRemote}
							tint
							title="Link a remote vault"
						/>
					</FormSection>
				</NativeForm>
			)}
		</>
	)
}
