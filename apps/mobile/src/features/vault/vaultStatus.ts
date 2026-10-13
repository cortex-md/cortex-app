import { CLOUD_SERVER_LABEL, getSyncServerLabel, type VaultListItem } from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"

import type { SymbolName } from "@/components/ui/Symbol"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"
import type { MobileVaultAccess } from "@/features/vault/vaultAccess"

export interface VaultStatusLine {
	label: string
	icon: SymbolName
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
	access?: MobileVaultAccess,
): VaultStatusLine {
	if (access === "needsAccess") return { icon: { md: "lock", sf: "lock" }, label: "Needs access" }
	const server = vaultServerLabel(item)
	switch (item.status) {
		case "synced": {
			const remoteName = remote?.name ?? item.entry.name
			const target = remoteName !== item.entry.name ? `“${remoteName}” on ${server}` : server
			return { icon: { md: "cloud_done", sf: "checkmark.icloud" }, label: `Syncs with ${target}` }
		}
		case "paused":
			return { icon: { md: "pause_circle", sf: "pause.circle" }, label: `Sync paused · ${server}` }
		case "missing":
			return {
				icon: { md: "warning", sf: "exclamationmark.triangle" },
				label: "Folder not found",
			}
		default:
			return { icon: { md: "smartphone", sf: "iphone" }, label: `Only on this ${DEVICE_LABEL}` }
	}
}

export function remoteVaultStatus(remote: RemoteVaultInfo, server: string): VaultStatusLine {
	const members = remote.memberCount ?? 1
	return {
		icon: { md: "cloud_download", sf: "icloud.and.arrow.down" },
		label: `${server} · ${members} member${members === 1 ? "" : "s"} · ${capitalize(remote.role)}`,
	}
}
