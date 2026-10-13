import { resolveSyncIndicatorStatus, useSyncStore } from "@cortex/core"
import {
	CloudCheck,
	CloudOff,
	History,
	type LucideIcon,
	ReceiptText,
	RefreshCw,
	Settings,
	Trash2,
	TriangleAlert,
} from "lucide-react-native"
import { Platform, StyleSheet, View } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { toast } from "@/features/feedback/useToast"
import { openSettings, openVersionHistory } from "@/features/navigation/routes"
import { getSyncMenuHeader, syncNow } from "@/features/sync/syncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

interface ChipPresentation {
	Icon: LucideIcon
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
		return { Icon: CloudCheck, label: "Synced", color: (colors) => colors.successText }
	}
	switch (indicator.kind) {
		case "offline":
			return { Icon: CloudOff, label: "Offline", color: (colors) => colors.warningText }
		case "error":
		case "denied":
			return {
				Icon: TriangleAlert,
				label: indicator.label,
				color: (colors) => colors.destructiveText,
			}
		case "synced":
			return { Icon: CloudCheck, label: "Synced", color: (colors) => colors.successText }
		default:
			return {
				Icon: RefreshCw,
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
				icon: { sf: "arrow.triangle.2.circlepath", Lucide: RefreshCw },
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
				icon: { sf: "list.bullet.rectangle", Lucide: ReceiptText },
				onPress: () => openSettings("sync-logs"),
			},
			{
				key: "version-history",
				label: "Version history",
				icon: { sf: "clock.arrow.circlepath", Lucide: History },
				onPress: () => openVersionHistory(),
			},
			{
				key: "deleted-notes",
				label: "Deleted notes",
				icon: { sf: "arrow.uturn.backward.circle", Lucide: Trash2 },
				onPress: () => openSettings("deleted-notes"),
			},
		],
		[
			{
				key: "sync-settings",
				label: "Sync settings",
				icon: { sf: "gearshape", Lucide: Settings },
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
		<View style={[styles.chip, IS_IOS ? null : { backgroundColor: colors.successBackground }]}>
			<presentation.Icon color={color} size={IS_IOS ? 16 : 18} strokeWidth={2.2} />
			<NativeMenu
				accessibilityLabel="Sync status"
				anchorStyle="plain"
				groups={buildSyncMenuGroups()}
				header={`Synced ${header.lastSynced.toLowerCase()} · ${header.server}`}
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
