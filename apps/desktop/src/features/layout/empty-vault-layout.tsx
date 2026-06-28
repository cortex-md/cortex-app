import { useAppStore, useAuthStore, useUIStore, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Badge, Button, isValidLucideIconName, LucideIcon } from "@cortex/ui"
import { FileText, FolderOpen, FolderPlus, User, Vault } from "lucide-react"
import { useState } from "react"
import { CreateVaultModal } from "../vault/CreateVaultModal"

function AccountBadge() {
	const authenticated = useAuthStore((s) => s.authenticated)
	const user = useAuthStore((s) => s.user)
	const openSettings = useUIStore((s) => s.openSettings)
	const openAuth = useUIStore((s) => s.openAuth)

	if (authenticated && user) {
		return (
			<button
				type="button"
				className="absolute top-3 right-4 flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors"
				onClick={() => openSettings("sync")}
			>
				<div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
					<User size={10} className="text-accent" />
				</div>
				<span className="truncate max-w-[160px]">{user.email}</span>
			</button>
		)
	}

	return (
		<button
			type="button"
			className="absolute top-3 right-4 flex items-center gap-2 text-[11px] text-text-disabled hover:text-text-muted transition-colors"
			onClick={() => openAuth("login")}
		>
			<span>Sign in</span>
		</button>
	)
}

export function EmptyVaultLayout() {
	const recentVaults = useVaultStore((s) => s.recentVaults)
	const openVault = useVaultStore((s) => s.openVault)
	const firstRunOnboardingSeen = useAppStore((s) => s.firstRunOnboardingSeen)
	const version = useAppStore((s) => s.version)

	const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false)
	const [selectedFolderPath, setSelectedFolderPath] = useState("")
	const showFirstRunGuidance = recentVaults.length === 0 && firstRunOnboardingSeen === false

	const handleOpenVault = async () => {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return

		const existingVault = recentVaults.find((vault) => vault.path === folderPath)

		if (existingVault) {
			await openVault(folderPath)
			return
		}

		setSelectedFolderPath(folderPath)
		setIsCreateVaultOpen(true)
	}

	const handleCreateVault = async () => {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return

		setSelectedFolderPath(folderPath)
		setIsCreateVaultOpen(true)
	}

	return (
		<div className="relative flex-1 flex flex-col items-center justify-center gap-2.5 px-6 text-text-muted text-sm">
			<AccountBadge />
			<CreateVaultModal
				open={isCreateVaultOpen}
				folderPath={selectedFolderPath}
				onOpenChange={setIsCreateVaultOpen}
			/>
			<div className="flex w-full max-w-[520px] flex-col items-center gap-3 text-center">
				<div className="flex items-center gap-2">
					<h1 className="text-2xl font-bold text-text-primary">Cortex</h1>
					<Badge variant="secondary">{version}</Badge>
				</div>
				{showFirstRunGuidance ? (
					<div className="flex w-full flex-col items-center gap-3">
						<p className="max-w-sm text-sm leading-6">
							Start with a folder. Cortex writes normal Markdown notes there and keeps workspace
							metadata tucked away in .cortex.
						</p>
						<div className="grid w-full max-w-md gap-2 text-left sm:grid-cols-2">
							<div className="flex items-start gap-2.5 rounded-md border border-border-subtle px-3 py-2.5">
								<FileText size={16} className="mt-0.5 shrink-0 text-text-muted" />
								<span className="text-xs leading-5">
									Your notes stay readable as files, even outside Cortex.
								</span>
							</div>
							<div className="flex items-start gap-2.5 rounded-md border border-border-subtle px-3 py-2.5">
								<Vault size={16} className="mt-0.5 shrink-0 text-text-muted" />
								<span className="text-xs leading-5">
									The welcome note opens after the vault is ready.
								</span>
							</div>
						</div>
					</div>
				) : (
					<p className="pt-2.5">Open an existing folder or create a new vault</p>
				)}
				<div className="flex flex-wrap justify-center gap-2 pt-1 pb-2.5">
					<Button onClick={handleCreateVault}>
						<FolderPlus size={16} />
						Create new vault
					</Button>
					<Button variant="outline" onClick={handleOpenVault}>
						<FolderOpen size={16} />
						Open folder
					</Button>
				</div>
			</div>
			{recentVaults.length > 0 && (
				<div className="pt-2.5 w-full max-w-sm">
					<h3 className="pb-2.5 text-center text-xs font-medium text-text-muted uppercase tracking-wide">
						Recent vaults
					</h3>
					<ul className="space-y-0.5">
						{recentVaults.map((vault) => (
							<li className="list-none" key={vault.path}>
								<button
									type="button"
									className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left hover:bg-bg-secondary"
									onClick={() => openVault(vault.path)}
								>
									<span className="flex items-center gap-1.5 shrink-0">
										{vault.color && (
											<span
												className="w-2.5 h-2.5 rounded-full shrink-0"
												style={{ backgroundColor: vault.color }}
											/>
										)}
										{vault.icon && isValidLucideIconName(vault.icon) ? (
											<LucideIcon name={vault.icon} size={16} />
										) : (
											<Vault size={16} />
										)}
									</span>
									<span className="flex flex-col min-w-0 flex-1">
										<span className="font-medium text-text-primary truncate">{vault.name}</span>
										<span className="text-[11px] text-text-muted truncate">{vault.path}</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
