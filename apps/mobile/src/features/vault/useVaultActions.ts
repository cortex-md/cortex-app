import {
	deleteImpact,
	forgetImpact,
	getErrorMessage,
	leaveImpact,
	leaveRemoteVault,
	linkVaultFolder,
	unlinkImpact,
	unlinkVaultFolder,
	useRemoteVaultStore,
	useVaultStore,
	type VaultImpact,
	type VaultListItem,
} from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import { useCallback, useRef, useState } from "react"

import type { ImpactCell } from "@/components/ui/dialogTypes"
import type { MenuGroup, MenuItem } from "@/components/ui/menuTypes"
import { toast, toastWithUndo } from "@/features/feedback/useToast"
import { openSettings, presentSheet } from "@/features/navigation/routes"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"
import { vaultServerLabel } from "@/features/vault/vaultStatus"
import type { MobileVaultAccess } from "@/features/vault/vaultAccess"
import { showVaultError } from "@/features/vault/vaultErrors"
import { locateVaultFolder } from "@/features/vault/vaultSyncAdapter"
import { reauthorizeMobileVault } from "@/platform/vaultAccess"

export interface PendingConfirm {
	impact: VaultImpact
	run: () => Promise<void>
}

export function impactCells(impact: VaultImpact): ImpactCell[] {
	return impact.cells.map((cell) => ({ label: cell.where, value: cell.what }))
}

function item(
	key: string,
	label: string,
	icon: MenuItem["icon"],
	onPress: () => void,
	destructive = false,
): MenuItem {
	return { destructive, icon, key, label, onPress }
}

export function useVaultActions(refresh: () => void, server: string) {
	const currentUuid = useVaultStore((state) => state.vault?.uuid ?? null)
	const removeRecentVault = useVaultStore((state) => state.removeRecentVault)
	const deleteRemoteVault = useRemoteVaultStore((state) => state.deleteRemoteVault)
	const { openVault, openingUuid } = useVaultSwitcher()
	const [pending, setPending] = useState<PendingConfirm | null>(null)
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
	const undoneRef = useRef(new Set<string>())

	const confirm = useCallback(
		(impact: VaultImpact, run: () => Promise<void>) => setPending({ impact, run }),
		[],
	)

	const runPending = async () => {
		const action = pending
		setPending(null)
		if (!action) return
		try {
			await action.run()
		} catch (error) {
			toast(getErrorMessage(error))
		}
	}

	const open = async (vaultItem: VaultListItem) => {
		toast(`Opening ${vaultItem.entry.name}…`)
		await openVault(vaultItem.entry)
	}

	const forget = (vaultItem: VaultListItem) => {
		const uuid = vaultItem.entry.uuid
		undoneRef.current.delete(uuid)
		setHidden((current) => new Set(current).add(uuid))
		const commit = () => {
			if (undoneRef.current.has(uuid)) return
			void removeRecentVault(uuid)
		}
		const timer = setTimeout(commit, 5200)
		toastWithUndo(`${vaultItem.entry.name} removed from the list`, () => {
			clearTimeout(timer)
			undoneRef.current.add(uuid)
			setHidden((current) => {
				const next = new Set(current)
				next.delete(uuid)
				return next
			})
		})
	}

	const unlink = async (vaultItem: VaultListItem) => {
		const remoteVaultId = vaultItem.remoteVaultId
		await unlinkVaultFolder(vaultItem.entry.path)
		refresh()
		const message = `${vaultItem.entry.name} is now only on this ${DEVICE_LABEL}`
		if (!remoteVaultId) {
			toast(message)
			return
		}
		toastWithUndo(message, () => {
			void linkVaultFolder(vaultItem.entry.path, remoteVaultId)
				.then(refresh)
				.catch((error) => toast(getErrorMessage(error)))
		})
	}

	const locate = async (vaultItem: VaultListItem) => {
		try {
			if (await locateVaultFolder(vaultItem.entry)) refresh()
		} catch (error) {
			toast(getErrorMessage(error))
		}
	}

	const reauthorize = async (vaultItem: VaultListItem) => {
		try {
			if (await reauthorizeMobileVault(vaultItem.entry.path)) refresh()
		} catch (error) {
			showVaultError(`Couldn't reauthorize “${vaultItem.entry.name}”`, error)
		}
	}

	const localMenu = (
		vaultItem: VaultListItem,
		remote: RemoteVaultInfo | null,
		access?: MobileVaultAccess,
	): MenuGroup[] => {
		const isCurrent = vaultItem.entry.uuid === currentUuid
		const itemServer = vaultServerLabel(vaultItem)
		const name = vaultItem.entry.name
		const removeItem = item(
			"remove",
			vaultItem.status === "missing" ? "Remove from list" : "Remove from list…",
			{ md: "playlist_remove", sf: "minus.circle" },
			() =>
				vaultItem.status === "missing"
					? forget(vaultItem)
					: confirm(forgetImpact(name, itemServer, DEVICE_LABEL), async () => forget(vaultItem)),
			true,
		)
		if (vaultItem.status === "missing") {
			return [
				[
					item(
						"locate",
						"Locate folder…",
						{ md: "folder_open", sf: "folder.badge.questionmark" },
						() => void locate(vaultItem),
					),
				],
				[removeItem],
			]
		}
		const openItem = isCurrent
			? []
			: [
					item(
						"open",
						"Open",
						{ md: "arrow_forward", sf: "arrow.right.circle" },
						() => void open(vaultItem),
					),
				]
		const accessItems =
			access === "needsAccess"
				? [
						item(
							"reauthorize",
							"Reauthorize…",
							{ md: "lock_open", sf: "lock.open" },
							() => void reauthorize(vaultItem),
						),
					]
				: []
		if (vaultItem.status === "local") {
			return [
				[
					...openItem,
					...accessItems,
					item(
						"start-sync",
						"Start syncing…",
						{ md: "sync", sf: "arrow.triangle.2.circlepath" },
						() => openSettings("sync/link", { vaultPath: vaultItem.entry.path }),
					),
				],
				[removeItem],
			]
		}
		return [
			[
				...openItem,
				...accessItems,
				item("sync-settings", "Sync settings…", { md: "settings", sf: "gearshape" }, () =>
					openSettings("sync/link", { vaultPath: vaultItem.entry.path }),
				),
			],
			[
				item(
					"stop-sync",
					"Stop syncing…",
					{ md: "link_off", sf: "xmark.icloud" },
					() =>
						confirm(unlinkImpact(name, remote?.name ?? name, itemServer, DEVICE_LABEL), () =>
							unlink(vaultItem),
						),
					true,
				),
				removeItem,
			],
		]
	}

	const remoteMenu = (remote: RemoteVaultInfo): MenuGroup[] => {
		const download = item(
			"download",
			"Download…",
			{ md: "cloud_download", sf: "icloud.and.arrow.down" },
			() => presentSheet("add-vault", { remoteVaultId: remote.id, start: "download" }),
		)
		const destructive =
			remote.role === "owner"
				? item(
						"delete",
						`Delete from ${server}…`,
						{ md: "delete", sf: "trash" },
						() =>
							confirm(
								deleteImpact(remote.name, server, remote.memberCount ?? 1, DEVICE_LABEL),
								async () => {
									await deleteRemoteVault(remote.id)
								},
							),
						true,
					)
				: item(
						"leave",
						"Leave vault…",
						{ md: "logout", sf: "rectangle.portrait.and.arrow.right" },
						() =>
							confirm(leaveImpact(remote.name, server, DEVICE_LABEL), async () => {
								await leaveRemoteVault(remote.id)
								toast(`You left ${remote.name}`)
							}),
						true,
					)
		return [[download], [destructive]]
	}

	return {
		currentUuid,
		hidden,
		localMenu,
		open,
		openingUuid,
		pending,
		remoteMenu,
		runPending,
		cancelPending: () => setPending(null),
	}
}
