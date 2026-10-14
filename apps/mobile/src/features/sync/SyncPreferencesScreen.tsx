import { useSyncStore } from "@cortex/core"
import type { SyncPreferences } from "@cortex/platform"
import { useState } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { FormTextField } from "@/features/sync/FormControls"
import {
	inferExcludeKind,
	resolveExcludedPaths,
	setExcludedPath,
} from "@/features/sync/syncAdapter"
import type { ExcludedPathEntry } from "@/features/sync/syncTypes"

type AppStateKey = Exclude<keyof SyncPreferences, "excludedPaths" | "ignoreImages">

const APP_STATE_ROWS: { key: AppStateKey; title: string; subtitle?: string }[] = [
	{ key: "syncSettings", title: "App settings" },
	{ key: "syncHotkeys", title: "Keyboard shortcuts" },
	{ key: "syncWorkspace", title: "Workspace layout", subtitle: "Open tabs and panes" },
	{ key: "syncBookmarks", title: "Bookmarks" },
	{ key: "syncPluginMetadata", title: "Plugin configuration" },
	{ key: "syncThemeMetadata", title: "Theme configuration" },
]

export function SyncPreferencesScreen() {
	const preferences = useSyncStore((state) => state.syncPreferences)
	const updateSyncPreference = useSyncStore((state) => state.updateSyncPreference)
	const [excludes, setExcludes] = useState<ExcludedPathEntry[]>(() =>
		resolveExcludedPaths(preferences.excludedPaths),
	)
	const [draft, setDraft] = useState("")
	const [fieldKey, setFieldKey] = useState(0)

	const addExclude = () => {
		const value = draft.trim()
		if (!value || excludes.some((entry) => entry.value === value)) return
		setExcludes([...excludes, { value, kind: inferExcludeKind(value) }])
		setDraft("")
		setFieldKey((key) => key + 1)
		void setExcludedPath(value, true)
	}

	const confirmRemove = (value: string) => {
		Alert.alert(`Sync "${value}" again?`, undefined, [
			{ style: "cancel", text: "Cancel" },
			{
				onPress: () => {
					setExcludes((current) => current.filter((entry) => entry.value !== value))
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
				{APP_STATE_ROWS.map((row) => (
					<FormToggle
						key={row.key}
						onValueChange={(value) => void updateSyncPreference(row.key, value)}
						subtitle={row.subtitle}
						title={row.title}
						value={preferences[row.key]}
					/>
				))}
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
