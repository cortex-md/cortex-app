import { useSyncStore } from "@cortex/core"
import type { SyncPreferences } from "@cortex/platform"
import { Switch } from "@cortex/ui"
import {
	BookmarkIcon,
	ImageIcon,
	KeyboardIcon,
	type LucideIcon,
	PaletteIcon,
	PanelsTopLeftIcon,
	PuzzleIcon,
	SettingsIcon,
} from "lucide-react"
import { ExcludedPathsSettings } from "../ExcludedPathsSettings"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "../SettingsPrimitives"
import { SignedOutNotice } from "./SignedOutNotice"
import { SyncDisabledNotice } from "./SyncDisabledNotice"

interface SyncPreferenceField {
	key: keyof Omit<SyncPreferences, "excludedPaths">
	label: string
	description?: string
	inverted?: boolean
	icon: LucideIcon
}

const contentPreferenceFields: SyncPreferenceField[] = [
	{
		key: "ignoreImages",
		label: "Images",
		description: "PNG, JPG and other attachments",
		inverted: true,
		icon: ImageIcon,
	},
]

const appStatePreferenceFields: SyncPreferenceField[] = [
	{ key: "syncSettings", label: "App settings", icon: SettingsIcon },
	{ key: "syncHotkeys", label: "Keyboard shortcuts", icon: KeyboardIcon },
	{
		key: "syncWorkspace",
		label: "Workspace layout",
		description: "Open tabs and panes",
		icon: PanelsTopLeftIcon,
	},
	{ key: "syncBookmarks", label: "Bookmarks", icon: BookmarkIcon },
	{ key: "syncPluginMetadata", label: "Plugin configuration", icon: PuzzleIcon },
	{ key: "syncThemeMetadata", label: "Theme configuration", icon: PaletteIcon },
]

interface SyncPreferenceGroupProps {
	title: string
	footer?: string
	fields: SyncPreferenceField[]
}

function SyncPreferenceGroup({ title, footer, fields }: SyncPreferenceGroupProps) {
	const syncPreferences = useSyncStore((state) => state.syncPreferences)
	const updateSyncPreference = useSyncStore((state) => state.updateSyncPreference)
	return (
		<SettingsSection title={title} footer={footer}>
			<SettingsGroup>
				{fields.map(({ key, label, description, inverted, icon: Icon }) => (
					<SettingsField
						key={key}
						fieldId={`sync-preferences.${key}`}
						icon={<Icon />}
						label={label}
						description={description}
						htmlFor={`sync-preference-${key}`}
					>
						<Switch
							id={`sync-preference-${key}`}
							size="sm"
							checked={inverted ? !syncPreferences[key] : syncPreferences[key]}
							onCheckedChange={(checked) =>
								void updateSyncPreference(key, inverted ? !checked : checked)
							}
						/>
					</SettingsField>
				))}
			</SettingsGroup>
		</SettingsSection>
	)
}

function SyncPreferencesSection() {
	return (
		<>
			<SyncPreferenceGroup
				title="Content"
				footer="Turn off to keep large attachments on this device only."
				fields={contentPreferenceFields}
			/>
			<SyncPreferenceGroup title="App state" fields={appStatePreferenceFields} />
		</>
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
