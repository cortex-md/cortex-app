import {
	CLOUD_SERVER_LABEL,
	deleteImpact,
	forgetImpact,
	getErrorMessage,
	getSyncServerLabel,
	getVaultDisplayPath,
	leaveImpact,
	leaveRemoteVault,
	linkVaultFolder,
	loadVaultListItems,
	resolveVaultColor,
	unlinkImpact,
	unlinkVaultFolder,
	useAuthStore,
	useRemoteVaultStore,
	useVaultStore,
	type VaultListItem,
} from "@cortex/core"
import { getPlatform, type RemoteVaultInfo } from "@cortex/platform"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	StatusBadge,
	toast,
} from "@cortex/ui"
import { Cloud, Laptop, MoreHorizontal, Pause, TriangleAlert } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { DEVICE_LABEL } from "../../vault/deviceLabel"
import { VaultTile } from "../../vault/VaultTile"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsList,
	SettingsListItem,
	SettingsPage,
	SettingsSection,
} from "../SettingsPrimitives"
import { runSettingsAction } from "../settingsActions"
import { openSettings } from "../settingsModal"
import { type VaultImpact, VaultImpactDialog } from "./VaultImpactDialog"

interface PendingAction {
	impact: VaultImpact
	run: () => Promise<void>
}

function StatusLine({ item, remoteName }: { item: VaultListItem; remoteName: string | null }) {
	const server = item.syncConfig ? getSyncServerLabel(item.syncConfig) : CLOUD_SERVER_LABEL
	const named = remoteName && remoteName !== item.entry.name ? `“${remoteName}” on ` : ""
	const status: Record<VaultListItem["status"], [ReactNode, string, string]> = {
		synced: [
			<Cloud key="synced" className="text-status-success-foreground" />,
			`Syncs with ${named}${server}`,
			"text-text-secondary",
		],
		paused: [<Pause key="paused" />, `Sync paused · ${server}`, "text-text-secondary"],
		local: [<Laptop key="local" />, "Only on this Mac", "text-text-secondary"],
		missing: [
			<TriangleAlert key="missing" className="text-status-warning-foreground" />,
			"Folder not found",
			"text-status-warning-foreground",
		],
	}
	const [icon, label, tone] = status[item.status]
	return (
		<span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3">
			<span className="truncate font-mono">{getVaultDisplayPath(item.entry)}</span>
			<span aria-hidden="true">·</span>
			{icon}
			<span className={tone}>{label}</span>
		</span>
	)
}

export function VaultsPage() {
	const vault = useVaultStore((state) => state.vault)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const removeRecentVault = useVaultStore((state) => state.removeRecentVault)
	const patchRecentVault = useVaultStore((state) => state.patchRecentVault)
	const authenticated = useAuthStore((state) => state.authenticated)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const fetchRemoteVaults = useRemoteVaultStore((state) => state.fetchRemoteVaults)
	const deleteRemoteVault = useRemoteVaultStore((state) => state.deleteRemoteVault)
	const [items, setItems] = useState<VaultListItem[]>([])
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
	const [pending, setPending] = useState<PendingAction | null>(null)
	const undoneRef = useRef(new Set<string>())

	useEffect(() => {
		let active = true
		void loadVaultListItems(recentVaults).then((next) => {
			if (active) setItems(next)
		})
		return () => {
			active = false
		}
	}, [recentVaults])

	useEffect(() => {
		if (authenticated) void fetchRemoteVaults()
	}, [authenticated, fetchRemoteVaults])

	const reload = () => void loadVaultListItems(useVaultStore.getState().recentVaults).then(setItems)
	const server = getSyncServerLabel(syncConfig)
	const linkedIds = new Set(items.map((item) => item.remoteVaultId).filter(Boolean))
	const localItems = items.filter((item) => !hidden.has(item.entry.uuid))
	const remoteOnly = remoteVaults.filter((remote) => !linkedIds.has(remote.id))
	const remoteFor = (item: VaultListItem) =>
		remoteVaults.find((remote) => remote.id === item.remoteVaultId) ?? null

	const confirm = (impact: VaultImpact, run: () => Promise<void>) => setPending({ impact, run })
	const runPending = async () => {
		const action = pending
		setPending(null)
		if (!action) return
		try {
			await action.run()
		} catch (error) {
			toast.error(getErrorMessage(error))
		}
	}

	const openVault = (item: VaultListItem) => {
		runSettingsAction("openVaultHere", item.entry)
		void getPlatform().window.closeCurrent()
	}

	const forget = (item: VaultListItem) => {
		const uuid = item.entry.uuid
		undoneRef.current.delete(uuid)
		setHidden((current) => new Set(current).add(uuid))
		const commit = () => {
			if (undoneRef.current.has(uuid)) return
			void removeRecentVault(uuid)
		}
		toast(`${item.entry.name} removed from the list`, {
			action: {
				label: "Undo",
				onClick: () => {
					undoneRef.current.add(uuid)
					setHidden((current) => {
						const next = new Set(current)
						next.delete(uuid)
						return next
					})
				},
			},
			onAutoClose: commit,
			onDismiss: commit,
		})
	}

	const unlink = async (item: VaultListItem) => {
		const remoteVaultId = item.remoteVaultId
		await unlinkVaultFolder(item.entry.path)
		reload()
		toast(`${item.entry.name} is now only on this Mac`, {
			action: remoteVaultId
				? {
						label: "Undo",
						onClick: () =>
							void linkVaultFolder(item.entry.path, remoteVaultId)
								.then(reload)
								.catch((error) => toast.error(getErrorMessage(error))),
					}
				: undefined,
		})
	}

	const locate = async (item: VaultListItem) => {
		const path = await getPlatform().dialog.pickFolder({ title: `Locate ${item.entry.name}` })
		if (!path) return
		await patchRecentVault(item.entry.uuid, { path })
		reload()
	}

	const localMenu = (item: VaultListItem) => {
		const isCurrent = item.entry.uuid === vault?.uuid
		const remote = remoteFor(item)
		const itemServer = item.syncConfig ? getSyncServerLabel(item.syncConfig) : server
		const showInFinder = (
			<DropdownMenuItem
				onSelect={() => {
					void getPlatform().dialog.revealFolder(item.entry.path)
					toast("Shown in Finder")
				}}
			>
				Show in Finder
			</DropdownMenuItem>
		)
		const removeItem = (
			<DropdownMenuItem
				onSelect={() =>
					confirm(forgetImpact(item.entry.name, itemServer, DEVICE_LABEL), async () => forget(item))
				}
			>
				Remove from list{item.status === "missing" ? "" : "…"}
			</DropdownMenuItem>
		)
		if (item.status === "missing") {
			return (
				<>
					<DropdownMenuItem onSelect={() => void locate(item)}>Locate folder…</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => forget(item)}>Remove from list</DropdownMenuItem>
				</>
			)
		}
		if (item.status === "local") {
			return (
				<>
					{showInFinder}
					{isCurrent ? (
						<DropdownMenuItem onSelect={() => openSettings("sync")}>
							Start syncing…
						</DropdownMenuItem>
					) : null}
					<DropdownMenuSeparator />
					{removeItem}
				</>
			)
		}
		return (
			<>
				{showInFinder}
				{isCurrent ? (
					<DropdownMenuItem onSelect={() => openSettings("sync")}>Sync settings…</DropdownMenuItem>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onSelect={() =>
						confirm(
							unlinkImpact(
								item.entry.name,
								remote?.name ?? item.entry.name,
								itemServer,
								DEVICE_LABEL,
							),
							() => unlink(item),
						)
					}
				>
					Stop syncing…
				</DropdownMenuItem>
				{removeItem}
			</>
		)
	}

	const remoteMenu = (remote: RemoteVaultInfo) =>
		remote.role === "owner" ? (
			<DropdownMenuItem
				variant="destructive"
				onSelect={() =>
					confirm(
						deleteImpact(remote.name, server, remote.memberCount ?? 1, DEVICE_LABEL),
						async () => {
							await deleteRemoteVault(remote.id)
							toast(`${remote.name} deleted from ${server}`)
						},
					)
				}
			>
				Delete from {server}…
			</DropdownMenuItem>
		) : (
			<DropdownMenuItem
				variant="destructive"
				onSelect={() =>
					confirm(leaveImpact(remote.name, server, DEVICE_LABEL), async () => {
						await leaveRemoteVault(remote.id)
						toast(`You left ${remote.name}`)
					})
				}
			>
				Leave vault…
			</DropdownMenuItem>
		)

	return (
		<SettingsPage>
			<SettingsSection
				title="On this Mac"
				fieldId="vaults.local"
				action={
					<Button
						variant="secondary"
						size="xs"
						onClick={() => runSettingsAction("openAddVault", { start: "choose" })}
					>
						Add a vault…
					</Button>
				}
			>
				<SettingsGroup>
					{localItems.length === 0 ? (
						<SettingsEmptyState>No vaults on this Mac yet.</SettingsEmptyState>
					) : (
						<SettingsList>
							{localItems.map((item) => {
								const isCurrent = item.entry.uuid === vault?.uuid
								return (
									<SettingsListItem key={item.entry.uuid} className="gap-3">
										<VaultTile name={item.entry.name} color={item.color} />
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="truncate text-sm font-medium text-foreground">
												{item.entry.name}
											</span>
											<StatusLine item={item} remoteName={remoteFor(item)?.name ?? null} />
										</span>
										<span className="flex shrink-0 items-center gap-1.5">
											{isCurrent ? (
												<StatusBadge color="green">Open now</StatusBadge>
											) : item.status === "missing" ? (
												<Button variant="ghost" size="xs" onClick={() => void locate(item)}>
													Locate…
												</Button>
											) : (
												<Button variant="ghost" size="xs" onClick={() => openVault(item)}>
													Open
												</Button>
											)}
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														aria-label={`More for ${item.entry.name}`}
													>
														<MoreHorizontal />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="min-w-[210px]">
													{localMenu(item)}
												</DropdownMenuContent>
											</DropdownMenu>
										</span>
									</SettingsListItem>
								)
							})}
						</SettingsList>
					)}
				</SettingsGroup>
			</SettingsSection>
			{remoteOnly.length > 0 ? (
				<SettingsSection
					title="In your account, not on this Mac"
					fieldId="vaults.remote"
					footer="Shared with you or created on another device."
				>
					<SettingsGroup>
						<SettingsList>
							{remoteOnly.map((remote) => (
								<SettingsListItem key={remote.id} className="gap-3">
									<VaultTile
										name={remote.name}
										color={resolveVaultColor({ uuid: remote.id, color: null })}
										className="opacity-60"
									/>
									<span className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-sm font-medium text-foreground">
											{remote.name}
										</span>
										<span className="truncate text-xs text-muted-foreground">
											{describeRemoteRow(server, remote)}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-1.5">
										<Button
											variant="ghost"
											size="xs"
											onClick={() =>
												runSettingsAction("openAddVault", {
													start: "download",
													remoteVaultId: remote.id,
												})
											}
										>
											Download…
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon" aria-label={`More for ${remote.name}`}>
													<MoreHorizontal />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="min-w-[210px]">
												{remoteMenu(remote)}
											</DropdownMenuContent>
										</DropdownMenu>
									</span>
								</SettingsListItem>
							))}
						</SettingsList>
					</SettingsGroup>
				</SettingsSection>
			) : null}
			<VaultImpactDialog
				impact={pending?.impact ?? null}
				onOpenChange={(open) => {
					if (!open) setPending(null)
				}}
				onConfirm={runPending}
			/>
		</SettingsPage>
	)
}

function describeRemoteRow(server: string, remote: RemoteVaultInfo): string {
	const members = remote.memberCount ?? 1
	const role = remote.role ? remote.role[0]?.toUpperCase() + remote.role.slice(1) : ""
	return [server, members === 1 ? "only you" : `${members} members`, role]
		.filter(Boolean)
		.join(" · ")
}
