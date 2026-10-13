import { getErrorMessage, useVaultStore } from "@cortex/core"
import { COMMUNITY_PLUGINS_WARNING } from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"
import {
	type PluginRecord,
	reportPluginOperationError,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { useMemo } from "react"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { openMarketplace } from "@/features/marketplace/marketplaceNavigation"
import { openSettings } from "@/features/navigation/routes"
import {
	enablePluginWithConsent,
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"

const PLUGINS_DIR = ".cortex/plugins"

async function setPluginEnabled(record: PluginRecord, enabled: boolean): Promise<void> {
	const pluginId = record.manifest.id
	try {
		if (enabled) {
			if (!(await enablePluginWithConsent(record))) return
		} else {
			await mobilePluginHost.disablePlugin(pluginId)
		}
		await mobilePluginHost.saveEnabledPlugins()
	} catch (cause) {
		reportPluginOperationError(enabled ? "enable" : "disable", pluginId, cause)
	}
}

async function showPluginsFolder(): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	try {
		await getPlatform().dialog.revealFolder(joinPath(vaultPath, PLUGINS_DIR))
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function pluginToggle(record: PluginRecord) {
	return (
		<FormToggle
			key={record.manifest.id}
			onValueChange={(enabled) => void setPluginEnabled(record, enabled)}
			subtitle={
				record.status === "error" && record.error ? record.error : record.manifest.description
			}
			title={record.manifest.name}
			value={record.status === "enabled"}
		/>
	)
}

export function PluginsSettingsScreen() {
	const plugins = usePluginStore((state) => state.plugins)
	const settingsPages = usePluginStore((state) => state.settingsPages)
	const allowCommunity = useCommunityPluginsAllowed()
	const { core, community } = useMemo(() => {
		const records = Object.values(plugins)
		return {
			community: records.filter((record) => record.community),
			core: records.filter((record) => !record.community),
		}
	}, [plugins])
	const pages = settingsPages.filter((page) => page.schema)

	return (
		<NativeForm>
			<FormSection title="Core plugins">
				{core.length === 0 ? <FormRow disabled title="No core plugins loaded" /> : null}
				{core.map(pluginToggle)}
			</FormSection>
			<FormSection footer={COMMUNITY_PLUGINS_WARNING} title="Community plugins">
				<FormToggle
					onValueChange={(allowed) => void setCommunityPluginsAllowed(allowed)}
					title="Allow community plugins"
					value={allowCommunity}
				/>
				{community.map(pluginToggle)}
				<FormRow chevron onPress={openMarketplace} title="Browse marketplace" />
				{community.length === 0 ? (
					<FormRow onPress={() => void showPluginsFolder()} tint title="Show plugins folder" />
				) : null}
			</FormSection>
			{pages.length > 0 ? (
				<FormSection title="Plugin settings">
					{pages.map((page) => (
						<FormRow
							chevron
							key={page.key}
							onPress={() => openSettings("plugin-settings", { pageKey: page.key })}
							title={page.title}
						/>
					))}
				</FormSection>
			) : null}
		</NativeForm>
	)
}
