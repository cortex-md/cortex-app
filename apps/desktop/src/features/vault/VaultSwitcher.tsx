import { useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
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
import { useState } from "react"
import { CreateVaultModal } from "./CreateVaultModal"

export function VaultSwitcher() {
	const { vault, recentVaults, openVault, closeVault } = useVaultStore()
	const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false)
	const [selectedFolderPath, setSelectedFolderPath] = useState("")

	const handleSwitchVault = async (path: string) => {
		if (vault?.path === path) return
		await closeVault()
		await openVault(path)
	}

	const handleOpenVault = async () => {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return

		const existingVault = recentVaults.find((v) => v.path === folderPath)
		if (existingVault) {
			await handleSwitchVault(folderPath)
			return
		}

		setSelectedFolderPath(folderPath)
		setIsCreateVaultOpen(true)
	}

	if (!vault) return null

	const currentEntry = recentVaults.find((v) => v.uuid === vault.uuid)

	return (
		<>
			<CreateVaultModal
				open={isCreateVaultOpen}
				folderPath={selectedFolderPath}
				onOpenChange={setIsCreateVaultOpen}
			/>
			<div className="vault-switcher px-1.5 pt-1.5 pb-1">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="vault-switcher-button w-full justify-between gap-2 px-2.5"
						>
							<span className="flex items-center gap-2 min-w-0">
								{currentEntry?.color && (
									<span
										className="w-2.5 h-2.5 rounded-full shrink-0"
										style={{ backgroundColor: currentEntry.color }}
									/>
								)}
								{currentEntry?.icon && isValidLucideIconName(currentEntry.icon) ? (
									<LucideIcon name={currentEntry.icon} size={16} />
								) : (
									<Vault size={16} className="shrink-0" />
								)}
								<span className="truncate text-sm font-medium">
									{currentEntry?.name ?? vault.name}
								</span>
							</span>
							<ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-64">
						<DropdownMenuLabel>Vaults</DropdownMenuLabel>
						{recentVaults.map((entry) => (
							<DropdownMenuItem
								key={entry.uuid}
								onClick={() => handleSwitchVault(entry.path)}
								className="gap-2"
							>
								<span className="flex items-center gap-2 min-w-0 flex-1">
									{entry.color && (
										<span
											className="w-2 h-2 rounded-full shrink-0"
											style={{ backgroundColor: entry.color }}
										/>
									)}
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
						<DropdownMenuItem onClick={handleOpenVault} className="gap-2">
							<FolderOpen size={14} />
							<span className="text-xs">Open Vault...</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</>
	)
}
