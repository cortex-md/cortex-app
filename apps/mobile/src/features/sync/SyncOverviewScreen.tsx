import {
	formatLastSyncedAt,
	getSyncServerLabel,
	resolveSyncIndicatorStatus,
	useDevicesStore,
	useEditorStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { useEffect, useState } from "react"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { openSettings, openVersionHistory } from "@/features/navigation/routes"
import { listSyncDevices, resolveLinkedRemoteVault, syncNow } from "@/features/sync/syncAdapter"
import { DEVICE_LABEL } from "@/features/sync/syncFixtures"

const SYNC_NOW_FEEDBACK_MS = 1400

export function SyncOverviewScreen() {
	const vault = useVaultStore((state) => state.vault)
	const engineState = useSyncStore((state) => state.engineState)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const syncingFiles = useSyncStore((state) => state.syncingFiles)
	const syncError = useSyncStore((state) => state.error)
	const initialSyncProgress = useSyncStore((state) => state.initialSyncProgress)
	const initialSyncComplete = useSyncStore((state) => state.initialSyncComplete)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSyncEnabled = useRemoteVaultStore((state) => state.setSyncEnabled)
	const deviceEntries = useDevicesStore((state) => state.deviceEntries)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [syncingNow, setSyncingNow] = useState(false)

	useEffect(() => {
		if (!syncingNow) return
		const timer = setTimeout(() => setSyncingNow(false), SYNC_NOW_FEEDBACK_MS)
		return () => clearTimeout(timer)
	}, [syncingNow])

	const enabled = syncConfig.enabled
	const linked = resolveLinkedRemoteVault(remoteVaults, linkedVaultId, syncConfig)
	const serverLabel = getSyncServerLabel(syncConfig)
	const indicator = resolveSyncIndicatorStatus({
		engineState,
		error: syncError,
		planBlocked: false,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount: Object.keys(syncingFiles).length,
		lastSyncedAt,
	})
	const busy = syncingNow || Boolean(indicator?.busy)
	const statusTitle = busy ? "Syncing…" : enabled ? "Up to date" : "Paused"
	const statusSubtitle = enabled
		? `Synced ${formatLastSyncedAt(lastSyncedAt).toLowerCase()}`
		: `Changes stay on this ${DEVICE_LABEL}`
	const devices = listSyncDevices(deviceEntries, lastSyncedAt)

	const handleSyncNow = () => {
		setSyncingNow(true)
		void syncNow()
	}

	return (
		<NativeForm>
			<FormSection>
				<FormRow
					icon={
						enabled
							? { sf: "checkmark.icloud", md: "cloud_done" }
							: { sf: "pause.circle", md: "pause_circle" }
					}
					subtitle={statusSubtitle}
					title={statusTitle}
				/>
				<FormToggle
					onValueChange={(value) => {
						if (vault) void setSyncEnabled(vault.path, value)
					}}
					title="Sync this vault"
					value={enabled}
				/>
				<FormRow
					disabled={busy || !enabled}
					icon={{ sf: "arrow.triangle.2.circlepath", md: "sync" }}
					onPress={handleSyncNow}
					tint
					title="Sync now"
				/>
			</FormSection>
			<FormSection title="Connection">
				<FormRow
					chevron
					onPress={() => openSettings("sync/link")}
					title="Remote vault"
					value={linked?.name ?? "Not linked"}
				/>
				<FormRow
					chevron
					onPress={() => openSettings("sync/self-hosted")}
					title="Server"
					value={serverLabel}
				/>
				<FormRow chevron onPress={() => openSettings("sync/members")} title="Members" />
				<FormRow chevron onPress={() => openSettings("sync/prefs")} title="Preferences" />
			</FormSection>
			{devices.length > 0 ? (
				<FormSection title="Devices">
					{devices.map((device) => (
						<FormRow
							icon={
								device.isCurrent
									? { sf: "iphone", md: "smartphone" }
									: { sf: "desktopcomputer", md: "computer" }
							}
							key={device.id}
							subtitle={device.isCurrent ? "This device" : device.lastSyncedLabel}
							title={device.name}
						/>
					))}
				</FormSection>
			) : null}
			<FormSection title="History">
				<FormRow
					chevron
					icon={{ sf: "list.bullet.rectangle", md: "receipt_long" }}
					onPress={() => openSettings("sync-logs")}
					title="Sync logs"
				/>
				<FormRow
					chevron
					icon={{ sf: "clock.arrow.circlepath", md: "history" }}
					onPress={() => openVersionHistory(activeFilePath ?? undefined)}
					title="Version history"
				/>
				<FormRow
					chevron
					icon={{ sf: "trash", md: "delete" }}
					onPress={() => openSettings("deleted-notes")}
					title="Deleted notes"
				/>
			</FormSection>
		</NativeForm>
	)
}
