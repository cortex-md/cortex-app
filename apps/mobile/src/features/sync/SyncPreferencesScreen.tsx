import { useSyncStore } from "@cortex/core"
import {
	type ExtensionSyncKind,
	formatExtensionSyncStatus,
	needsExtensionSyncReview,
	useExtensionSyncStore,
} from "@cortex/marketplace"
import type { SyncPreferences } from "@cortex/platform"
import { useState } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { openSettings } from "@/features/navigation/routes"
import { FormTextField } from "@/features/sync/FormControls"
import { resolveExcludedPaths, setExcludedPath } from "@/features/sync/syncAdapter"

type AppStateKey = Exclude<keyof SyncPreferences, "excludedPaths" | "ignoreImages">

const APP_STATE_ROWS: {
	key: AppStateKey
	title: string
	subtitle?: string
	extensions?: ExtensionSyncKind
}[] = [
	{ key: "syncSettings", title: "App settings" },
	{ key: "syncHotkeys", title: "Keyboard shortcuts" },
	{ key: "syncWorkspace", title: "Workspace layout", subtitle: "Open tabs and panes" },
	{ key: "syncBookmarks", title: "Bookmarks" },
	{
		key: "syncPluginMetadata",
		title: "Plugin configuration",
		subtitle: "Installed plugins, versions and which are on",
		extensions: "plugins",
	},
	{
		key: "syncThemeMetadata",
		title: "Theme configuration",
		subtitle: "Installed themes and versions",
		extensions: "themes",
	},
]

function reviewExtensionSync(kind: ExtensionSyncKind): void {
	if (kind === "plugins") openSettings("plugins")
	else openSettings("marketplace", { tab: "themes" })
}

export function SyncPreferencesScreen() {
	const preferences = useSyncStore((state) => state.syncPreferences)
	const extensionSync = useExtensionSyncStore()
	const updateSyncPreference = useSyncStore((state) => state.updateSyncPreference)
	const excludes = resolveExcludedPaths(preferences.excludedPaths)
	const [draft, setDraft] = useState("")
	const [fieldKey, setFieldKey] = useState(0)

	const addExclude = () => {
		const value = draft.trim()
		if (!value || excludes.some((entry) => entry.value === value)) return
		setDraft("")
		setFieldKey((key) => key + 1)
		void setExcludedPath(value, true)
	}

	const confirmRemove = (value: string) => {
		Alert.alert(`Sync "${value}" again?`, undefined, [
			{ style: "cancel", text: "Cancel" },
			{
				onPress: () => {
					void setExcludedPath(value, false)
				},
				style: "destructive",
				text: "Remove",
			},
		])
	}

	return (
		<NativeForm>
			<FormSection title="Content">
				<FormToggle
					onValueChange={(value) => void updateSyncPreference("ignoreImages", !value)}
					subtitle="PNG, JPG and other attachments"
					title="Images"
					value={!preferences.ignoreImages}
				/>
			</FormSection>
			<FormSection title="App state">
				{APP_STATE_ROWS.flatMap((row) => {
					const status =
						row.extensions && preferences[row.key] ? extensionSync[row.extensions] : null
					const toggle = (
						<FormToggle
							key={row.key}
							onValueChange={(value) => void updateSyncPreference(row.key, value)}
							subtitle={
								status && row.extensions
									? formatExtensionSyncStatus(row.extensions, status)
									: row.subtitle
							}
							title={row.title}
							value={preferences[row.key]}
						/>
					)
					if (!status || !row.extensions || !needsExtensionSyncReview(status)) return [toggle]
					const kind = row.extensions
					return [
						toggle,
						<FormRow
							chevron
							key={`${row.key}-review`}
							onPress={() => reviewExtensionSync(kind)}
							tint
							title={kind === "plugins" ? "Review plugins" : "Review themes"}
						/>,
					]
				})}
			</FormSection>
			<FormSection
				footer="Excluded items stay on this device and are never uploaded."
				title="Excluded from sync"
			>
				{excludes.map((entry) => (
					<FormRow
						key={entry.value}
						onPress={() => confirmRemove(entry.value)}
						title={entry.value}
						value={entry.kind}
					/>
				))}
				<FormTextField
					key={fieldKey}
					keyboard="url"
					onChangeText={setDraft}
					onSubmit={addExclude}
					placeholder="Folder, file or pattern"
				/>
				<FormRow disabled={!draft.trim()} onPress={addExclude} tint title="Add" />
			</FormSection>
		</NativeForm>
	)
}
