import { resolveSyncIndicatorStatus, useSyncStore } from "@cortex/core"
import { Platform, StyleSheet, View } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { toast } from "@/features/feedback/useToast"
import { openSettings, openVersionHistory } from "@/features/navigation/routes"
import { getSyncMenuHeader, syncNow } from "@/features/sync/syncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"
const SYNCED_ICON: SymbolName = { sf: "checkmark.icloud", md: "cloud_done" }

interface ChipPresentation {
	icon: SymbolName
	label: string
	color: (colors: MobileColors) => string
}

export function useSyncChipPresentation(): ChipPresentation {
	const engineState = useSyncStore((state) => state.engineState)
	const error = useSyncStore((state) => state.error)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const syncingFiles = useSyncStore((state) => state.syncingFiles)
	const initialSyncProgress = useSyncStore((state) => state.initialSyncProgress)
	const initialSyncComplete = useSyncStore((state) => state.initialSyncComplete)
	const indicator = resolveSyncIndicatorStatus({
		engineState,
		error,
		planBlocked: false,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount: Object.keys(syncingFiles).length,
		lastSyncedAt,
	})
	if (!indicator) {
		return { icon: SYNCED_ICON, label: "Synced", color: (colors) => colors.successText }
	}
	switch (indicator.kind) {
		case "offline":
			return {
				icon: { sf: "icloud.slash", md: "cloud_off" },
				label: "Offline",
				color: (colors) => colors.warningText,
			}
		case "error":
		case "denied":
			return {
				icon: { sf: "exclamationmark.icloud", md: "sync_problem" },
				label: indicator.label,
				color: (colors) => colors.destructiveText,
			}
		case "synced":
			return { icon: SYNCED_ICON, label: "Synced", color: (colors) => colors.successText }
		default:
			return {
				icon: { sf: "arrow.triangle.2.circlepath.icloud", md: "sync" },
				label: indicator.busy ? "Syncing…" : indicator.label,
				color: (colors) => colors.secondaryLabel,
			}
	}
}

export function buildSyncMenuGroups(): MenuGroup[] {
	return [
		[
			{
				key: "sync-now",
				label: "Sync now",
				icon: { sf: "arrow.triangle.2.circlepath", md: "sync" },
				onPress: () => {
					void syncNow().then(
						() => toast("Syncing with Cortex Cloud"),
						() => toast("Could not start sync"),
					)
				},
			},
		],
		[
			{
				key: "sync-logs",
				label: "Sync logs",
				icon: { sf: "list.bullet.rectangle", md: "receipt_long" },
				onPress: () => openSettings("sync-logs"),
			},
			{
				key: "version-history",
				label: "Version history",
				icon: { sf: "clock.arrow.circlepath", md: "history" },
				onPress: () => openVersionHistory(),
			},
		],
		[
			{
				key: "sync-settings",
				label: "Sync settings",
				icon: { sf: "gearshape", md: "settings" },
				onPress: () => openSettings("sync"),
			},
		],
	]
}

export function SyncChip() {
	const { colors } = useMobileColors()
	const presentation = useSyncChipPresentation()
	const header = getSyncMenuHeader()
	const color = presentation.color(colors)

	return (
		<View style={[styles.chip, IS_IOS ? null : { backgroundColor: colors.fill }]}>
			<SymbolIcon color={color} name={presentation.icon} size={IS_IOS ? 16 : 18} />
			<NativeMenu
				accessibilityLabel="Sync status"
				anchorStyle="plain"
				groups={buildSyncMenuGroups()}
				header={`Last synced ${header.lastSynced.toLowerCase()} · ${header.server}`}
				title={presentation.label}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	chip: {
		alignItems: "center",
		alignSelf: "flex-start",
		borderRadius: IS_IOS ? 999 : 8,
		flexDirection: "row",
		gap: 6,
		height: 32,
		marginHorizontal: 16,
		paddingLeft: IS_IOS ? 4 : 12,
		paddingRight: IS_IOS ? 4 : 4,
	},
})
