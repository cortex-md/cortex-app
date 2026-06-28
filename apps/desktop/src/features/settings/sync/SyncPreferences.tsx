import { useSyncStore } from "@cortex/core"
import type { SyncPreferences } from "@cortex/platform"
import { Switch } from "@cortex/ui"
import { ExcludedPathsSettings } from "../ExcludedPathsSettings"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "../SettingsPrimitives"
import { SignedOutNotice } from "./SignedOutNotice"
import { SyncDisabledNotice } from "./SyncDisabledNotice"

interface SyncPreferenceField {
	key: keyof Omit<SyncPreferences, "excludedPaths">
	label: string
}

const syncPreferenceFields: SyncPreferenceField[] = [
	{ key: "ignoreImages", label: "Ignore images" },
	{ key: "syncSettings", label: "App settings" },
	{ key: "syncHotkeys", label: "Keyboard shortcuts" },
	{ key: "syncWorkspace", label: "Workspace layout" },
	{ key: "syncBookmarks", label: "Bookmarks" },
	{ key: "syncPluginMetadata", label: "Plugin configuration" },
	{ key: "syncThemeMetadata", label: "Theme configuration" },
]

function SyncPreferencesSection() {
	const syncPreferences = useSyncStore((state) => state.syncPreferences)
	const updateSyncPreference = useSyncStore((state) => state.updateSyncPreference)
	return (
		<SettingsSection title="Content" description="Choose what sync should include for this vault.">
			<SettingsGroup>
				{syncPreferenceFields.map(({ key, label }) => (
					<SettingsField key={key} label={label} htmlFor={`sync-preference-${key}`}>
						<Switch
							id={`sync-preference-${key}`}
							checked={syncPreferences[key]}
							onCheckedChange={(checked) => void updateSyncPreference(key, checked)}
						/>
					</SettingsField>
				))}
			</SettingsGroup>
		</SettingsSection>
	)
}

interface SyncPreferencesPageProps {
	authenticated: boolean
	syncEnabled: boolean
}

export function SyncPreferencesPage({ authenticated, syncEnabled }: SyncPreferencesPageProps) {
	if (!authenticated) {
		return (
			<SettingsPage>
				<SignedOutNotice />
			</SettingsPage>
		)
	}
	if (!syncEnabled) {
		return (
			<SettingsPage>
				<SyncDisabledNotice description="Enable sync in the Sync page to configure content preferences." />
			</SettingsPage>
		)
	}
	return (
		<SettingsPage>
			<SyncPreferencesSection />
			<ExcludedPathsSettings />
		</SettingsPage>
	)
}
