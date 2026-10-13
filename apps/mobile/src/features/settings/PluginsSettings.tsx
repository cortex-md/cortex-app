import { COMMUNITY_PLUGINS_WARNING } from "@cortex/marketplace"
import { getErrorMessage, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"
import {
	type PluginRecord,
	reportPluginOperationError,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { Button, FieldGroup, Host, ListItem, Row, Switch } from "@expo/ui"
import { Stack, useLocalSearchParams } from "expo-router"
import { useMemo } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { toast } from "@/features/feedback/useToast"
import { openMarketplace } from "@/features/marketplace/marketplaceNavigation"
import { openSettings } from "@/features/navigation/routes"
import {
	enablePluginWithConsent,
	setCommunityPluginsAllowed,
	useCommunityPluginsAllowed,
} from "@/features/plugins/communityPluginsAccess"
import { PluginSettingsForm } from "@/features/plugins/PluginSettingsForm"
import { SettingsBlock, SettingsFooter, SettingsSection } from "@/features/settings/SettingsLayout"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const PLUGINS_DIR = ".cortex/plugins"
const COMMUNITY_EMPTY =
	"No community plugins installed. Place plugins in vault/.cortex/plugins/ to get started."

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
		toast("Shown in Files")
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function openPluginSettings(pageKey: string): void {
	openSettings("plugin-settings", { pageKey })
}

function getPluginSubtitle(record: PluginRecord): string {
	if (record.status === "error" && record.error) return record.error
	return record.manifest.description
}

function PluginRow({ record }: { record: PluginRecord }) {
	const page = usePluginStore((state) =>
		state.settingsPages.find((candidate) => candidate.owner === record.manifest.id),
	)
	const { colors } = useMobileColors()
	const meta = `v${record.manifest.version} · by ${record.manifest.author || "Cortex"}`
	return (
		<ListItem
			colors={{
				containerColor: colors.cell,
				contentColor: colors.label,
				supportingContentColor: colors.secondaryLabel,
			}}
			onPress={page?.schema ? () => openPluginSettings(page.key) : undefined}
			supportingText={`${meta}\n${getPluginSubtitle(record)}`}
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
}

function CommunityEmptyState() {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.empty, { backgroundColor: colors.cell }]}>
			<Text style={[styles.emptyText, { color: colors.secondaryLabel }]}>{COMMUNITY_EMPTY}</Text>
			{IS_IOS ? null : (
				<Host matchContents style={styles.buttons}>
					<Row spacing={8}>
						<Button label="Browse" onPress={openMarketplace} variant="filled" />
						<Button label="Open folder" onPress={() => void showPluginsFolder()} variant="outlined" />
					</Row>
				</Host>
			)}
		</View>
	)
}

export function PluginsSettingsSection() {
	const plugins = usePluginStore((state) => state.plugins)
	const allowCommunity = useCommunityPluginsAllowed()
	const { core, community } = useMemo(() => {
		const records = Object.values(plugins)
		return {
			community: records.filter((record) => record.community),
			core: records.filter((record) => !record.community),
		}
	}, [plugins])

	return (
		<>
			<SettingsBlock>
				<SettingsSection title="Core plugins">
					{core.length === 0 ? (
						<SettingsRow disabled title="No core plugins loaded" />
					) : (
						core.map((record) => <PluginRow key={record.manifest.id} record={record} />)
					)}
				</SettingsSection>
				<SettingsFooter>Built-in plugin modules shipped with Cortex.</SettingsFooter>
			</SettingsBlock>

			<SettingsBlock>
				<SettingsSection title="Community plugins">
					<SettingsRow
						onToggle={(allowed) => void setCommunityPluginsAllowed(allowed)}
						subtitle={COMMUNITY_PLUGINS_WARNING}
						title="Allow community plugins"
						toggled={allowCommunity}
					/>
					{community.map((record) => (
						<PluginRow key={record.manifest.id} record={record} />
					))}
					{community.length === 0 && IS_IOS ? (
						<>
							<SettingsRow onPress={openMarketplace} tint title="Browse" />
							<SettingsRow onPress={() => void showPluginsFolder()} tint title="Show in Files" />
						</>
					) : null}
				</SettingsSection>
				{community.length === 0 ? <CommunityEmptyState /> : null}
				<SettingsFooter>Vault-scoped plugins installed in this workspace.</SettingsFooter>
			</SettingsBlock>
		</>
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
			style={{ backgroundColor: colors.groupedBackground }}
		>
			<Stack.Screen options={{ title: page?.title ?? "Plugin" }} />
			<Host matchContents>
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
	buttons: {
		marginTop: 12,
	},
	content: {
		paddingHorizontal: 12,
		paddingVertical: 16,
	},
	empty: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		marginTop: 8,
		padding: 16,
	},
	emptyText: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
		textAlign: IS_IOS ? "center" : "left",
	},
})
