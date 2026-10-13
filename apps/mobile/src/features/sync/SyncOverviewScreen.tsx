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
import { FieldGroup } from "@expo/ui"
import {
	CircleCheck,
	CirclePause,
	Clock,
	FileText,
	Monitor,
	Smartphone,
	Trash2,
} from "lucide-react-native"
import { useEffect, useState } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { openSettings, openVersionHistory } from "@/features/navigation/routes"
import {
	ActionButton,
	SettingsBlock,
	SettingsCard,
	SettingsFooterText,
	SettingsGroup,
	SettingsPage,
} from "@/features/sync/SettingsPage"
import {
	countSyncedNotes,
	listSyncDevices,
	resolveLinkedRemoteVault,
	syncNow,
} from "@/features/sync/syncAdapter"
import { DEVICE_LABEL } from "@/features/sync/syncFixtures"
import { useMobileColors } from "@/hooks/useMobileColors"

const SYNC_NOW_FEEDBACK_MS = 1400

function StatTile({ label, value }: { label: string; value: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.tile, { backgroundColor: colors.cell }]}>
			<Text style={[styles.tileValue, { color: colors.label }]}>{value}</Text>
			<Text style={[styles.tileLabel, { color: colors.secondaryLabel }]}>{label}</Text>
		</View>
	)
}

export function SyncOverviewScreen() {
	const { colors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
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

	const vaultName = vault?.name ?? "This vault"
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
	const lastSynced = formatLastSyncedAt(lastSyncedAt)
	const heroTitle = enabled ? `${vaultName} is up to date` : "Sync is paused"
	const heroSubtitle = busy
		? "Syncing…"
		: enabled
			? `Synced ${lastSynced.toLowerCase()} · ${serverLabel}`
			: `Changes stay on this ${DEVICE_LABEL} until you resume`
	const devices = listSyncDevices(deviceEntries, lastSyncedAt)
	const HeroIcon = enabled ? CircleCheck : CirclePause

	const handleSyncNow = () => {
		setSyncingNow(true)
		void syncNow()
	}

	return (
		<SettingsPage subtitle="Keep this vault the same on every device.">
			<View style={styles.heroWrap}>
				<SettingsCard>
					<View style={styles.heroHead}>
						<HeroIcon
							color={enabled ? colors.successText : colors.secondaryLabel}
							size={28}
							strokeWidth={2}
						/>
						<View style={styles.heroText}>
							<Text style={[styles.heroTitle, { color: colors.label }]}>{heroTitle}</Text>
							<Text style={[styles.heroSubtitle, { color: colors.secondaryLabel }]}>
								{heroSubtitle}
							</Text>
						</View>
					</View>
					<View style={styles.heroAction}>
						<ActionButton
							disabled={busy || !enabled}
							label={busy ? "Syncing…" : "Sync now"}
							onPress={handleSyncNow}
							variant="filled"
							wide
						/>
					</View>
				</SettingsCard>
			</View>

			<View style={styles.tiles}>
				<StatTile label="Notes synced" value={String(countSyncedNotes(files))} />
				<StatTile label="Devices" value={String(devices.length)} />
				<StatTile label="Your access" value={linked?.role ?? "Owner"} />
			</View>

			<SettingsGroup>
				<FieldGroup.Section>
					<SettingsRow
						onToggle={(value) => {
							if (vault) void setSyncEnabled(vault.path, value)
						}}
						subtitle="Pause without unlinking the remote vault."
						title="Sync this vault"
						toggled={enabled}
					/>
				</FieldGroup.Section>
				<FieldGroup.Section title="Remote vault">
					<SettingsRow
						chevron
						onPress={() => openSettings("sync/link")}
						subtitle="Linked remote vault"
						title={linked?.name ?? "Not linked"}
						value="Change"
					/>
					<SettingsRow
						chevron
						onPress={() => openSettings("sync/self-hosted")}
						title="Server"
						value={serverLabel}
					/>
					<SettingsRow chevron onPress={() => openSettings("sync/members")} title="Members" />
					<SettingsRow chevron onPress={() => openSettings("sync/prefs")} title="Preferences" />
				</FieldGroup.Section>
			</SettingsGroup>

			<SettingsBlock title="Devices">
				<GroupedList>
					{devices.map((device) => (
						<GroupedRow
							key={device.id}
							leading={
								device.isCurrent ? (
									<Smartphone color={colors.secondaryLabel} size={22} strokeWidth={2} />
								) : (
									<Monitor color={colors.secondaryLabel} size={22} strokeWidth={2} />
								)
							}
							subtitle={device.lastSyncedLabel}
							title={device.name}
							trailing={device.isCurrent ? <Badge label="This device" tint /> : null}
						/>
					))}
				</GroupedList>
				<SettingsFooterText>Devices appear here after signing in to this vault.</SettingsFooterText>
			</SettingsBlock>

			<SettingsGroup>
				<FieldGroup.Section title="History & recovery">
					<SettingsRow
						chevron
						Icon={Clock}
						onPress={() => openSettings("sync-logs")}
						subtitle="Every upload, download and conflict"
						title="Sync logs"
					/>
					<SettingsRow
						chevron
						Icon={FileText}
						onPress={() => openVersionHistory(activeFilePath ?? undefined)}
						subtitle="Restore earlier versions of a note"
						title="Version history"
					/>
					<SettingsRow
						chevron
						Icon={Trash2}
						onPress={() => openSettings("deleted-notes")}
						subtitle="Bring back notes removed on any device"
						title="Deleted notes"
					/>
				</FieldGroup.Section>
			</SettingsGroup>
		</SettingsPage>
	)
}

const styles = StyleSheet.create({
	heroAction: {
		marginTop: 14,
	},
	heroHead: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
	},
	heroSubtitle: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: 2,
	},
	heroText: {
		flex: 1,
		minWidth: 0,
	},
	heroTitle: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	heroWrap: {
		marginTop: 12,
	},
	tile: {
		borderCurve: "continuous",
		borderRadius: Platform.OS === "ios" ? 18 : 16,
		flex: 1,
		gap: 2,
		paddingHorizontal: 12,
		paddingVertical: 12,
	},
	tileLabel: {
		fontSize: 12,
		lineHeight: 16,
	},
	tileValue: {
		fontSize: 22,
		fontVariant: ["tabular-nums"],
		fontWeight: "600",
		lineHeight: 28,
	},
	tiles: {
		flexDirection: "row",
		gap: 8,
		marginHorizontal: 16,
		marginTop: 12,
	},
})
