import { COMMUNITY_PLUGINS_WARNING } from "@cortex/marketplace"
import { type PluginRecord, usePluginStore } from "@cortex/plugin-host-core"
import { Button, Item, LucideIcon, SimpleTooltip, Switch } from "@cortex/ui"
import { ExternalLink, FolderOpen, Store } from "lucide-react"
import type { OpenMarketplaceHandler } from "../marketplace/openMarketplaceView"
import {
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "../plugins/communityPluginsSetting"
import {
	SettingsEmptyState,
	SettingsField,
	SettingsGroup,
	SettingsList,
	SettingsListItem,
	SettingsPage,
	SettingsSection,
} from "./SettingsPrimitives"
import { runSettingsAction } from "./settingsActions"

interface PluginsSectionProps {
	onBrowseMarketplace: OpenMarketplaceHandler
}

function PluginRow({
	record,
	onOpenMarketplace,
}: {
	record: PluginRecord
	onOpenMarketplace?: (pluginId: string) => void
}) {
	const isEnabled = record.status === "enabled"
	const hasError = record.status === "error"
	const marketplaceLabel = `Open ${record.manifest.name} in Marketplace`

	return (
		<SettingsListItem data-settings-field={`plugins.${record.manifest.id}`}>
			<Item
				asChild
				className="settings-plugin-marketplace-link flex-nowrap rounded-none border-0 p-0 text-[length:inherit]"
			>
				<button
					type="button"
					aria-label={marketplaceLabel}
					disabled={!onOpenMarketplace}
					onClick={() => onOpenMarketplace?.(record.manifest.id)}
				>
					<div className="settings-plugin-icon">
						<LucideIcon name={record.manifest.icon} size={16} className="text-text-muted" />
					</div>
					<div className="flex min-w-0 flex-1 flex-col">
						<div className="flex items-center gap-2">
							<SimpleTooltip label={record.manifest.name}>
								<span className="truncate text-sm font-medium text-foreground">
									{record.manifest.name}
								</span>
							</SimpleTooltip>
							<span className="text-xs text-muted-foreground">v{record.manifest.version}</span>
							<span className="text-xs text-muted-foreground">by {record.manifest.author}</span>
						</div>
						<SimpleTooltip label={record.manifest.description}>
							<SimpleTooltip label={record.error}>
								<span className="truncate text-xs text-muted-foreground">
									{record.manifest.description}
								</span>
							</SimpleTooltip>
						</SimpleTooltip>
						{hasError && record.error && (
							<span className="truncate text-xs text-status-error-foreground">{record.error}</span>
						)}
					</div>
					{onOpenMarketplace && (
						<ExternalLink size={13} className="settings-plugin-marketplace-icon" aria-hidden />
					)}
				</button>
			</Item>
			<Switch
				checked={isEnabled}
				onCheckedChange={(enabled) =>
					runSettingsAction("setPluginEnabled", { pluginId: record.manifest.id, enabled })
				}
			/>
		</SettingsListItem>
	)
}

export function PluginsSection({ onBrowseMarketplace }: PluginsSectionProps) {
	const plugins = usePluginStore((s) => s.plugins)
	const allowCommunity = useCommunityPluginsAllowed()

	const pluginRecords = Object.values(plugins)
	const corePlugins = pluginRecords.filter((p) => !p.community)
	const communityPlugins = pluginRecords.filter((p) => p.community)

	return (
		<SettingsPage>
			<SettingsSection title="Restricted mode">
				<SettingsGroup>
					<SettingsField
						fieldId="plugins.allow-community"
						description={COMMUNITY_PLUGINS_WARNING}
						htmlFor="allow-community-plugins"
					>
						<Switch
							id="allow-community-plugins"
							checked={allowCommunity}
							onCheckedChange={(checked) => void setCommunityPluginsAllowed(checked)}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection
				fieldId="plugins.core"
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
				fieldId="plugins.community"
				title="Community plugins"
				description="Vault-scoped plugins installed in this workspace."
				action={
					<>
						<Button variant="ghost" onClick={() => onBrowseMarketplace("plugins")}>
							<Store size={12} />
							Browse
						</Button>
						<Button variant="ghost" onClick={() => runSettingsAction("openCommunityPluginsFolder")}>
							<FolderOpen size={12} />
							Open folder
						</Button>
					</>
				}
			>
				<SettingsGroup>
					{!allowCommunity ? (
						<SettingsEmptyState>
							Community plugins are turned off. Allow them above to load plugins from this vault.
						</SettingsEmptyState>
					) : communityPlugins.length === 0 ? (
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
