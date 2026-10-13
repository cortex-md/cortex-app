import { CLOUD_SERVER_LABEL, getSyncServerLabel, type VaultListItem } from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import {
	CloudDownload,
	type LucideIcon,
	PauseCircle,
	Smartphone,
	TriangleAlert,
	CloudCheck,
} from "lucide-react-native"

import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"
import type { MobileColors } from "@/theme/colors"

export type VaultTone = "ok" | "warn" | "muted"

export interface VaultStatusLine {
	label: string
	tone: VaultTone
	Icon: LucideIcon
}

function capitalize(value: string): string {
	return value ? value[0]?.toUpperCase() + value.slice(1) : value
}

export function vaultServerLabel(item: VaultListItem): string {
	return item.syncConfig ? getSyncServerLabel(item.syncConfig) : CLOUD_SERVER_LABEL
}

export function localVaultStatus(
	item: VaultListItem,
	remote: RemoteVaultInfo | null,
): VaultStatusLine {
	const server = vaultServerLabel(item)
	switch (item.status) {
		case "synced": {
			const remoteName = remote?.name ?? item.entry.name
			const target = remoteName !== item.entry.name ? `“${remoteName}” on ${server}` : server
			return { Icon: CloudCheck, label: `Syncs with ${target}`, tone: "ok" }
		}
		case "paused":
			return { Icon: PauseCircle, label: `Sync paused · ${server}`, tone: "muted" }
		case "missing":
			return { Icon: TriangleAlert, label: "Folder not found", tone: "warn" }
		default:
			return { Icon: Smartphone, label: `Only on this ${DEVICE_LABEL}`, tone: "muted" }
	}
}

export function remoteVaultStatus(remote: RemoteVaultInfo, server: string): VaultStatusLine {
	const members = remote.memberCount ?? 1
	return {
		Icon: CloudDownload,
		label: `${server} · ${members} member${members === 1 ? "" : "s"} · ${capitalize(remote.role)}`,
		tone: "muted",
	}
}

export function toneColor(tone: VaultTone, colors: MobileColors): string {
	if (tone === "ok") return colors.successText
	if (tone === "warn") return colors.warningText
	return colors.secondaryLabel
}
