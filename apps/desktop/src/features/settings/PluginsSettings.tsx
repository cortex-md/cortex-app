import { useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import {
	disablePlugin,
	enablePlugin,
	type PluginRecord,
	saveEnabledPlugins,
} from "@cortex/plugin-host-core"
import { getCommunityPluginsDir, usePluginStore } from "@cortex/plugin-host-web"
import { Button, LucideIcon, Switch } from "@cortex/ui"
import { ExternalLink, FolderOpen, Store } from "lucide-react"
import { useCallback } from "react"
import {
	type OpenMarketplaceHandler,
	openMarketplaceView,
} from "../marketplace/openMarketplaceView"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsList,
	SettingsListItem,
	SettingsPage,
	SettingsSection,
} from "./SettingsPrimitives"

async function openCommunityPluginsFolder() {
	const dir = getCommunityPluginsDir()
	const platform = getPlatform()
	try {
		await platform.fs.createDir(dir)
	} catch {}
	try {
		await platform.dialog.revealFolder(dir)
	} catch {
		await platform.dialog.showAlert(
			"Plugins Folder",
			`Community plugins directory: ${dir}\n\nCreate this folder to install community plugins.`,
		)
	}
}

interface PluginsSectionProps {
	onBrowseMarketplace?: OpenMarketplaceHandler
}

function PluginRow({
	record,
	onOpenMarketplace,
}: {
	record: PluginRecord
	onOpenMarketplace?: (pluginId: string) => void
}) {
	const vault = useVaultStore((s) => s.vault)
	const isEnabled = record.status === "enabled"
	const hasError = record.status === "error"
	const marketplaceLabel = `Open ${record.manifest.name} in Marketplace`

	const handleToggle = useCallback(
		async (checked: boolean) => {
			if (checked) {
				await enablePlugin(record.manifest.id, () => vault?.path ?? null)
			} else {
				await disablePlugin(record.manifest.id)
			}
			if (vault?.path) {
				await saveEnabledPlugins(vault.path)
			}
		},
		[record.manifest.id, vault],
	)

	return (
		<SettingsListItem>
			<button
				type="button"
				className="settings-plugin-marketplace-link"
				aria-label={marketplaceLabel}
				disabled={!onOpenMarketplace}
				onClick={() => onOpenMarketplace?.(record.manifest.id)}
			>
				<div className="settings-plugin-icon">
					<LucideIcon name={record.manifest.icon} size={16} className="text-text-muted" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex items-center gap-2">
						<span className="truncate text-sm font-medium text-foreground">
							{record.manifest.name}
						</span>
						<span className="text-xs text-muted-foreground">v{record.manifest.version}</span>
						<span className="text-xs text-muted-foreground">by {record.manifest.author}</span>
					</div>
					<span className="truncate text-xs text-muted-foreground">
						{record.manifest.description}
					</span>
					{hasError && record.error && (
						<span className="truncate text-xs text-status-error-foreground">{record.error}</span>
					)}
				</div>
				{onOpenMarketplace && (
					<ExternalLink size={13} className="settings-plugin-marketplace-icon" aria-hidden />
				)}
			</button>
			<Switch checked={isEnabled} onCheckedChange={handleToggle} />
		</SettingsListItem>
	)
}

export function PluginsSection({ onBrowseMarketplace = openMarketplaceView }: PluginsSectionProps) {
	const plugins = usePluginStore((s) => s.plugins)

	const pluginRecords = Object.values(plugins)
	const corePlugins = pluginRecords.filter((p) => p.manifest.author === "Cortex")
	const communityPlugins = pluginRecords.filter((p) => p.manifest.author !== "Cortex")

	return (
		<SettingsPage>
			<SettingsSection
				title="Core plugins"
				description="Built-in plugin modules shipped with Cortex."
			>
				<SettingsGroup>
					{corePlugins.length === 0 ? (
						<SettingsEmptyState>No core plugins installed</SettingsEmptyState>
					) : (
						<SettingsList>
							{corePlugins.map((record) => (
								<PluginRow key={record.manifest.id} record={record} />
							))}
						</SettingsList>
					)}
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection
				title="Community plugins"
				description="Vault-scoped plugins installed in this workspace."
				action={
					<>
						<Button variant="ghost" size="sm" onClick={() => onBrowseMarketplace("plugins")}>
							<Store size={12} />
							Browse
						</Button>
						<Button variant="ghost" size="sm" onClick={openCommunityPluginsFolder}>
							<FolderOpen size={12} />
							Open folder
						</Button>
					</>
				}
			>
				<SettingsGroup>
					{communityPlugins.length === 0 ? (
						<SettingsEmptyState>
							No community plugins installed. Place plugins in vault/.cortex/plugins/ to get
							started.
						</SettingsEmptyState>
					) : (
						<SettingsList>
							{communityPlugins.map((record) => (
								<PluginRow
									key={record.manifest.id}
									record={record}
									onOpenMarketplace={(pluginId) =>
										onBrowseMarketplace("plugins", { selectedEntryId: pluginId })
									}
								/>
							))}
						</SettingsList>
					)}
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
