import {
	getVaultStatusTitles,
	loadVaultListItems,
	resolveVaultColor,
	useAuthStore,
	useRemoteVaultStore,
	useVaultStore,
	type VaultListItem,
	type VaultRegistryEntry,
} from "@cortex/core"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
	Popover,
	PopoverContent,
	PopoverTrigger,
	SimpleTooltip,
	toast,
} from "@cortex/ui"
import {
	Check,
	ChevronsUpDown,
	Cloud,
	Download,
	Pause,
	Plus,
	Settings,
	TriangleAlert,
} from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react"
import type { MenuItem } from "@/utils/context-menu"
import { useContextMenu } from "../context-menu/useContextMenu"
import { openSettings } from "../settings/settingsModal"
import { DEVICE_LABEL } from "./deviceLabel"
import { VaultTile } from "./VaultTile"
import { openAddVault, openRecentVault } from "./vaultActions"

const STATUS_ICON: Record<VaultListItem["status"], ReactNode> = {
	synced: <Cloud className="size-3.5 text-status-success-foreground" aria-hidden="true" />,
	paused: <Pause className="size-3.5 text-text-secondary" aria-hidden="true" />,
	local: null,
	missing: <TriangleAlert className="size-3.5 text-status-warning-foreground" aria-hidden="true" />,
}

const VAULT_STATUS_TITLE = getVaultStatusTitles(DEVICE_LABEL)

function vaultMenuItems(entry: VaultRegistryEntry): MenuItem[] {
	return [
		{
			id: "open-new-window",
			text: "Open in New Window",
			action: () => openRecentVault(entry, "new-window"),
		},
		{
			id: "open-this-window",
			text: "Open in This Window",
			action: () => openRecentVault(entry, "current-window"),
		},
	]
}

function useSwitcherItems(open: boolean) {
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const fetchRemoteVaults = useRemoteVaultStore((state) => state.fetchRemoteVaults)
	const authenticated = useAuthStore((state) => state.authenticated)
	const [items, setItems] = useState<VaultListItem[]>([])

	useEffect(() => {
		if (open && authenticated) void fetchRemoteVaults()
	}, [open, authenticated, fetchRemoteVaults])

	useEffect(() => {
		if (!open) return
		let active = true
		void loadVaultListItems(recentVaults).then((next) => {
			if (active) setItems(next)
		})
		return () => {
			active = false
		}
	}, [open, recentVaults])

	const localItems = items.length
		? items
		: recentVaults.map(
				(entry): VaultListItem => ({
					entry,
					color: resolveVaultColor(entry),
					status: "local",
					remoteVaultId: null,
					syncConfig: null,
				}),
			)
	const linked = new Set(localItems.map((item) => item.remoteVaultId).filter(Boolean))
	const remoteOnly = remoteVaults.filter((remote) => !linked.has(remote.id))
	return { localItems, remoteOnly, remoteVaults }
}

const modKey = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl+"

export function VaultSwitcher() {
	const vault = useVaultStore((state) => state.vault)
	const [open, setOpen] = useState(false)
	const [selected, setSelected] = useState("")
	const altKeyRef = useRef(false)
	const { showMenu, menu } = useContextMenu()
	const { localItems, remoteOnly, remoteVaults } = useSwitcherItems(open)

	if (!vault) return null

	const current = localItems.find((item) => item.entry.uuid === vault.uuid)
	const currentName = current?.entry.name ?? vault.name
	const currentColor = current?.color ?? resolveVaultColor({ uuid: vault.uuid, color: null })

	const close = () => setOpen(false)

	const openItem = (item: VaultListItem, target: "auto" | "current-window" | "new-window") => {
		close()
		if (item.entry.uuid === vault.uuid) return
		if (item.status === "missing") {
			toast(`${item.entry.name}: folder not found`, {
				description: "Locate it in Settings → Vaults",
				action: { label: "Locate…", onClick: () => openSettings("vaults") },
			})
			return
		}
		if (target !== "new-window") toast.loading(`Opening ${item.entry.name}…`, { duration: 1400 })
		void openRecentVault(item.entry, target)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
			const item = localItems[Number(event.key) - 1]
			if (!item || item.entry.uuid === vault.uuid) return
			event.preventDefault()
			openItem(item, "auto")
			return
		}
		if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return
		const item = localItems.find((candidate) => candidate.entry.uuid === selected)
		if (!item) return
		event.preventDefault()
		openItem(item, "new-window")
	}

	return (
		<div className="vault-switcher">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button size="sm" variant="ghost" className="vault-switcher-button max-w-full">
						<VaultTile
							name={currentName}
							color={currentColor}
							size="sm"
							className="size-6 rounded-lg text-[12px]"
						/>
						<span className="min-w-0 truncate">{currentName}</span>
						<ChevronsUpDown size={13} className="shrink-0 text-text-muted" />
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="vault-switcher-menu w-[300px] p-0">
					<Command loop value={selected} onValueChange={setSelected} onKeyDown={handleKeyDown}>
						<CommandInput placeholder="Switch vault…" aria-label="Find a vault" />
						<CommandList>
							<CommandEmpty>No vaults match.</CommandEmpty>
							<CommandGroup heading="On this Mac">
								{localItems.map((item, index) => {
									const isCurrent = item.entry.uuid === vault.uuid
									const shortcut = !isCurrent && index < 9 ? `${modKey}${index + 1}` : null
									const remote = remoteVaults.find(
										(candidate) => candidate.id === item.remoteVaultId,
									)
									const remoteName = remote && remote.name !== item.entry.name ? remote.name : null
									return (
										<SimpleTooltip
											key={item.entry.uuid}
											label={`${VAULT_STATUS_TITLE[item.status]}${remoteName ? ` with “${remoteName}”` : ""}`}
											side="right"
										>
											<CommandItem
												value={item.entry.uuid}
												keywords={[item.entry.name, remoteName ?? ""]}
												onPointerDown={(event) => {
													altKeyRef.current = event.altKey
												}}
												onSelect={() => {
													openItem(item, altKeyRef.current ? "current-window" : "auto")
													altKeyRef.current = false
												}}
												onContextMenu={(event) => {
													if (isCurrent) return
													event.preventDefault()
													showMenu(vaultMenuItems(item.entry), {
														x: event.clientX,
														y: event.clientY,
													})
												}}
											>
												<VaultTile name={item.entry.name} color={item.color} size="sm" />
												<span className="min-w-0 flex-1 truncate">
													{item.entry.name}
													{remoteName ? (
														<span className="ml-1.5 text-text-secondary">→ {remoteName}</span>
													) : null}
												</span>
												{STATUS_ICON[item.status]}
												{isCurrent ? (
													<Check
														className="size-3.5 text-brand"
														strokeWidth={2.5}
														aria-hidden="true"
													/>
												) : null}
												{shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
											</CommandItem>
										</SimpleTooltip>
									)
								})}
							</CommandGroup>
							{remoteOnly.length > 0 ? (
								<CommandGroup heading="In your account">
									{remoteOnly.map((remote) => (
										<SimpleTooltip key={remote.id} label="Download to this Mac" side="right">
											<CommandItem
												value={`remote:${remote.id}`}
												keywords={[remote.name]}
												onSelect={() => {
													close()
													openAddVault({ start: "download", remoteVaultId: remote.id })
												}}
											>
												<VaultTile
													name={remote.name}
													color={resolveVaultColor({ uuid: remote.id, color: null })}
													size="sm"
													className="opacity-60"
												/>
												<span className="min-w-0 flex-1 truncate">{remote.name}</span>
												<Download className="size-3.5 text-text-secondary" aria-hidden="true" />
											</CommandItem>
										</SimpleTooltip>
									))}
								</CommandGroup>
							) : null}
						</CommandList>
						<CommandSeparator />
						<CommandGroup>
							<CommandItem
								value="action:add"
								onSelect={() => {
									close()
									openAddVault()
								}}
							>
								<Plus className="size-[15px]" />
								<span className="flex-1">Add a vault…</span>
							</CommandItem>
							<CommandItem
								value="action:manage"
								onSelect={() => {
									close()
									openSettings("vaults")
								}}
							>
								<Settings className="size-[15px]" />
								<span className="flex-1">Manage vaults…</span>
							</CommandItem>
						</CommandGroup>
					</Command>
				</PopoverContent>
			</Popover>
			{menu}
		</div>
	)
}
