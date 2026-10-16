import { useAppStore, useAuthStore, useVaultStore } from "@cortex/core"
import { Badge, Button, Item, isValidLucideIconName, LucideIcon } from "@cortex/ui"
import { FileText, FolderOpen, FolderPlus, User, Vault } from "lucide-react"
import { openAuth } from "@/utils/modals"
import { openSettings } from "../settings/settingsModal"
import { openAddVault, openRecentVault } from "../vault/vaultActions"

function AccountBadge() {
	const authenticated = useAuthStore((s) => s.authenticated)
	const user = useAuthStore((s) => s.user)

	if (authenticated && user) {
		return (
			<Button
				variant="ghost"
				size="xs"
				className="absolute top-3 right-4 h-auto gap-2 px-0 text-xs text-text-muted transition-colors hover:bg-transparent hover:text-text-primary active:scale-100"
				onClick={() => openSettings("sync")}
			>
				<div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
					<User size={10} className="text-accent" />
				</div>
				<span className="truncate max-w-[160px]">{user.email}</span>
			</Button>
		)
	}

	return (
		<Button
			variant="ghost"
			size="xs"
			className="absolute top-3 right-4 h-auto gap-2 px-0 text-[11px] text-text-disabled transition-colors hover:bg-transparent hover:text-text-muted active:scale-100"
			onClick={() => openAuth("login")}
		>
			<span>Sign in</span>
		</Button>
	)
}

function createVaultFromPicker() {
	openAddVault({ start: "create" })
}

function openVaultFromPicker() {
	openAddVault({ start: "open" })
}

export function EmptyVaultLayout() {
	const recentVaults = useVaultStore((s) => s.recentVaults)
	const firstRunOnboardingSeen = useAppStore((s) => s.firstRunOnboardingSeen)
	const version = useAppStore((s) => s.version)

	const showFirstRunGuidance = recentVaults.length === 0 && firstRunOnboardingSeen === false

	return (
		<div className="relative flex-1 flex flex-col items-center justify-center gap-2.5 px-6 text-text-muted text-sm">
			<AccountBadge />
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
					<Button size="sm" onClick={createVaultFromPicker}>
						<FolderPlus size={16} />
						Create new vault
					</Button>
					<Button size="sm" variant="outline" onClick={openVaultFromPicker}>
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
								<Item
									asChild
									size="sm"
									className="w-full flex-nowrap rounded border-0 text-left text-sm hover:bg-bg-secondary"
								>
									<button type="button" onClick={() => void openRecentVault(vault)}>
										<span className="flex items-center shrink-0">
											{vault.icon && isValidLucideIconName(vault.icon) ? (
												<LucideIcon name={vault.icon} size={16} />
											) : (
												<Vault size={16} />
											)}
										</span>
										<span className="flex flex-col min-w-0 flex-1">
											<span className="font-medium text-text-primary truncate">{vault.name}</span>
											<span className="text-[11px] text-text-muted truncate">
												{vault.displayPath ?? vault.path}
											</span>
										</span>
									</button>
								</Item>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
