import { useVaultStore, type VaultRegistryEntry } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, isValidLucideIconName, LucideIcon } from "@cortex/ui"
import { Trash2, Vault } from "lucide-react"
import { formatShortDate } from "@/utils/format"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsList,
	SettingsListItem,
	SettingsSection,
} from "../SettingsPrimitives"

function formatLastOpened(timestamp: number): string {
	const date = new Date(timestamp)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

	if (diffDays === 0) return "Today"
	if (diffDays === 1) return "Yesterday"
	if (diffDays < 7) return `${diffDays} days ago`
	return formatShortDate(date)
}

function VaultRow({ entry }: { entry: VaultRegistryEntry }) {
	const isActive = useVaultStore((state) => state.vault?.uuid === entry.uuid)
	const removeRecentVault = useVaultStore((state) => state.removeRecentVault)

	const handleOpen = () => {
		if (!isActive) void getPlatform().window.openVaultWindow(entry.path)
	}

	const handleRemove = async () => {
		await removeRecentVault(entry.uuid)
	}

	return (
		<SettingsListItem>
			<span className="flex items-center gap-2 min-w-0 flex-1">
				{entry.icon && isValidLucideIconName(entry.icon) ? (
					<LucideIcon name={entry.icon} size={16} className="shrink-0 text-text-muted" />
				) : (
					<Vault size={16} className="shrink-0 text-text-muted" />
				)}
				<span className="flex flex-col min-w-0">
					<span className="truncate text-sm font-medium text-foreground" title={entry.name}>
						{entry.name}
					</span>
					<span
						className="truncate text-xs text-muted-foreground"
						title={entry.displayPath ?? entry.path}
					>
						{entry.displayPath ?? entry.path}
					</span>
				</span>
			</span>
			<span className="text-xs text-muted-foreground whitespace-nowrap">
				{formatLastOpened(entry.lastOpened)}
			</span>
			<span className="flex items-center gap-1">
				{!isActive && (
					<Button variant="ghost" size="sm" onClick={handleOpen} className="h-7 px-2">
						Open
					</Button>
				)}
				{isActive && <span className="px-2 text-xs font-medium text-accent">Active</span>}
				<Button
					variant="ghost"
					size="icon"
					onClick={handleRemove}
					aria-label={`Remove ${entry.name} from recents`}
					className="h-7 w-7 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
				>
					<Trash2 size={12} />
				</Button>
			</span>
		</SettingsListItem>
	)
}

export function VaultsSection() {
	const recentVaults = useVaultStore((state) => state.recentVaults)
	return (
		<SettingsSection
			fieldId="general.vaults"
			title="Vaults"
			description="Recently opened vaults on this device."
		>
			<SettingsGroup>
				{recentVaults.length === 0 ? (
					<SettingsEmptyState>No recent vaults</SettingsEmptyState>
				) : (
					<SettingsList>
						{recentVaults.map((entry) => (
							<VaultRow key={entry.uuid} entry={entry} />
						))}
					</SettingsList>
				)}
			</SettingsGroup>
		</SettingsSection>
	)
}
