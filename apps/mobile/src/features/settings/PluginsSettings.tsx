import { COMMUNITY_PLUGINS_WARNING } from "@cortex/marketplace"
import {
	type PluginRecord,
	reportPluginOperationError,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { FieldGroup, Host, ListItem, Switch } from "@expo/ui"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { ScrollView, StyleSheet } from "react-native"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { openMarketplace } from "@/features/marketplace/marketplaceNavigation"
import {
	enablePluginWithConsent,
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import { PluginSettingsForm } from "@/features/plugins/PluginSettingsForm"
import { useMobileColors } from "@/hooks/useMobileColors"

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

function openPluginSettings(pageKey: string): void {
	router.push({ params: { pageKey }, pathname: "/(settings)/plugin-settings" as never })
}

function getPluginSupportingText(record: PluginRecord): string {
	if (record.status === "error" && record.error) return record.error
	return record.manifest.description
}

export function PluginsSettingsSection() {
	const plugins = usePluginStore((state) => state.plugins)
	const settingsPages = usePluginStore((state) => state.settingsPages)
	const allowCommunity = useCommunityPluginsAllowed()
	const records = Object.values(plugins)

	return (
		<FieldGroup.Section title="Plugins">
			<ListItem
				supportingText={COMMUNITY_PLUGINS_WARNING}
				trailing={
					<Switch
						label="Allow community plugins"
						onValueChange={(allowed) => void setCommunityPluginsAllowed(allowed)}
						value={allowCommunity}
					/>
				}
			>
				Allow community plugins
			</ListItem>
			{records.length === 0 ? (
				<ListItem>No plugins installed</ListItem>
			) : (
				records.map((record) => {
					const pluginId = record.manifest.id
					const page = settingsPages.find((candidate) => candidate.owner === pluginId)
					return (
						<ListItem
							key={pluginId}
							onPress={page?.schema ? () => openPluginSettings(page.key) : undefined}
							supportingText={getPluginSupportingText(record)}
							trailing={
								<Switch
									label={record.manifest.name}
									onValueChange={(enabled) => void setPluginEnabled(record, enabled)}
									value={record.status === "enabled"}
								/>
							}
						>
							{record.manifest.name}
						</ListItem>
					)
				})
			)}
			<ListItem onPress={openMarketplace}>Browse community plugins</ListItem>
		</FieldGroup.Section>
	)
}

export function PluginSettingsScreen() {
	const { pageKey } = useLocalSearchParams<{ pageKey?: string }>()
	const page = usePluginStore((state) => state.settingsPages.find((item) => item.key === pageKey))
	const { colors } = useMobileColors()

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			style={{ backgroundColor: colors.background }}
		>
			<Stack.Screen options={{ title: page?.title ?? "Plugin" }} />
			<Host>
				<FieldGroup>
					{page?.schema ? (
						<PluginSettingsForm owner={page.owner} schema={page.schema} title="Settings" />
					) : (
						<FieldGroup.Section>
							<ListItem supportingText="Enable the plugin to configure it.">
								Settings unavailable
							</ListItem>
						</FieldGroup.Section>
					)}
				</FieldGroup>
			</Host>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 12,
		paddingVertical: 16,
	},
})
