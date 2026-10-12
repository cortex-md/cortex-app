import { useVaultStore, type VaultRegistryEntry } from "@cortex/core"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	isValidLucideIconName,
	LucideIcon,
} from "@cortex/ui"
import { Check, ChevronsUpDown, FolderOpen, Vault } from "lucide-react"
import type { MenuItem } from "@/utils/context-menu"
import { useContextMenu } from "../context-menu/useContextMenu"
import { openRecentVault, pickVaultFolder } from "./createVaultModalStore"

function openVaultFolder() {
	void pickVaultFolder("open")
}

function vaultMenuItems(entry: VaultRegistryEntry): MenuItem[] {
	return [
		{ id: "open-new-window", text: "Open in New Window", action: () => openRecentVault(entry) },
		{
			id: "open-this-window",
			text: "Open in This Window",
			action: () => openRecentVault(entry, "current-window"),
		},
	]
}

export function VaultSwitcher() {
	const vault = useVaultStore((state) => state.vault)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const { showMenu, menu } = useContextMenu()

	if (!vault) return null

	const currentEntry = recentVaults.find((v) => v.uuid === vault.uuid)

	return (
		<div className="vault-switcher">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="vault-switcher-button w-full justify-between gap-2">
						<span className="flex items-center gap-2 min-w-0">
							{currentEntry?.icon && isValidLucideIconName(currentEntry.icon) ? (
								<LucideIcon name={currentEntry.icon} size={16} />
							) : (
								<Vault size={16} className="shrink-0" />
							)}
							<span className="truncate">{currentEntry?.name ?? vault.name}</span>
						</span>
						<ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64">
					<DropdownMenuLabel>Vaults</DropdownMenuLabel>
					{recentVaults.map((entry) => (
						<DropdownMenuItem
							key={entry.uuid}
							onClick={(event) =>
								void openRecentVault(entry, event.altKey ? "current-window" : "auto")
							}
							onContextMenu={(event) => {
								if (entry.uuid === vault.uuid) return
								event.preventDefault()
								showMenu(vaultMenuItems(entry), { x: event.clientX, y: event.clientY })
							}}
							title="Opens in a new window. Option-click to open here."
							className="gap-2"
						>
							<span className="flex items-center gap-2 min-w-0 flex-1">
								{entry.icon && isValidLucideIconName(entry.icon) ? (
									<LucideIcon name={entry.icon} size={14} />
								) : (
									<Vault size={14} className="shrink-0 text-text-muted" />
								)}
								<span className="flex flex-col min-w-0">
									<span className="truncate text-xs">{entry.name}</span>
									<span className="truncate text-[10px] text-muted-foreground">
										{entry.displayPath ?? entry.path}
									</span>
								</span>
							</span>
							{entry.uuid === vault.uuid && <Check size={14} className="shrink-0 text-accent" />}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={openVaultFolder} className="gap-2">
						<FolderOpen size={14} />
						<span className="text-xs">Open Vault...</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{menu}
		</div>
	)
}
