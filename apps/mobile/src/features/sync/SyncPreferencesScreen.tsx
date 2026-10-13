import { useSyncStore } from "@cortex/core"
import type { SyncPreferences } from "@cortex/platform"
import { FieldGroup, Text as NativeText } from "@expo/ui"
import { CircleMinus, X } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native"

import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { SettingsRow } from "@/components/ui/SettingsRow"
import {
	ActionButton,
	SettingsBlock,
	SettingsFooterText,
	SettingsGroup,
	SettingsPage,
} from "@/features/sync/SettingsPage"
import { inferExcludeKind, resolveExcludedPaths, setExcludedPath } from "@/features/sync/syncAdapter"
import type { ExcludedPathEntry } from "@/features/sync/syncFixtures"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

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
	const { colors } = useMobileColors()
	const preferences = useSyncStore((state) => state.syncPreferences)
	const updateSyncPreference = useSyncStore((state) => state.updateSyncPreference)
	const [excludes, setExcludes] = useState<ExcludedPathEntry[]>(() =>
		resolveExcludedPaths(preferences.excludedPaths),
	)
	const [draft, setDraft] = useState("")

	const addExclude = () => {
		const value = draft.trim()
		if (!value || excludes.some((entry) => entry.value === value)) return
		setExcludes([...excludes, { value, kind: inferExcludeKind(value) }])
		setDraft("")
		void setExcludedPath(value, true)
	}

	const removeExclude = (value: string) => {
		setExcludes(excludes.filter((entry) => entry.value !== value))
		void setExcludedPath(value, false)
	}

	return (
		<SettingsPage subtitle="Choose what travels with this vault.">
			<SettingsGroup>
				<FieldGroup.Section title="Content">
					<SettingsRow
						onToggle={(value) => void updateSyncPreference("ignoreImages", !value)}
						subtitle="PNG, JPG and other attachments"
						title="Images"
						toggled={!preferences.ignoreImages}
					/>
					<FieldGroup.SectionFooter>
						<NativeText textStyle={{ color: colors.secondaryLabel }}>
							Turn off to keep large attachments on this device only.
						</NativeText>
					</FieldGroup.SectionFooter>
				</FieldGroup.Section>
				<FieldGroup.Section title="App state">
					{APP_STATE_ROWS.map((row) => (
						<SettingsRow
							key={row.key}
							onToggle={(value) => void updateSyncPreference(row.key, value)}
							subtitle={row.subtitle}
							title={row.title}
							toggled={preferences[row.key]}
						/>
					))}
				</FieldGroup.Section>
			</SettingsGroup>

			<SettingsBlock title="Excluded from sync">
				<View style={styles.addRow}>
					<TextInput
						autoCapitalize="none"
						autoCorrect={false}
						onChangeText={setDraft}
						onSubmitEditing={addExclude}
						placeholder={IS_IOS ? "Add a folder, file or pattern" : "Folder, file or pattern"}
						placeholderTextColor={colors.placeholder}
						returnKeyType="done"
						style={[
							styles.input,
							IS_IOS
								? { backgroundColor: colors.cell, color: colors.label }
								: { borderColor: colors.border, color: colors.label },
						]}
						value={draft}
					/>
					<ActionButton
						disabled={!draft.trim()}
						label="Add"
						onPress={addExclude}
						variant={IS_IOS ? "text" : "outlined"}
					/>
				</View>
				<GroupedList>
					{excludes.map((entry) => (
						<GroupedRow
							key={entry.value}
							leading={
								IS_IOS ? (
									<Pressable
										accessibilityLabel={`Remove ${entry.value}`}
										hitSlop={8}
										onPress={() => removeExclude(entry.value)}
									>
										<CircleMinus color={colors.destructive} size={22} strokeWidth={2} />
									</Pressable>
								) : undefined
							}
							title={entry.value}
							trailing={
								IS_IOS ? undefined : (
									<Pressable
										accessibilityLabel={`Remove ${entry.value}`}
										hitSlop={8}
										onPress={() => removeExclude(entry.value)}
									>
										<X color={colors.secondaryLabel} size={22} strokeWidth={2} />
									</Pressable>
								)
							}
							value={entry.kind}
						/>
					))}
				</GroupedList>
				<SettingsFooterText>
					Excluded items stay on this device and are never uploaded.
				</SettingsFooterText>
			</SettingsBlock>
		</SettingsPage>
	)
}

const styles = StyleSheet.create({
	addRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		marginBottom: 12,
		marginHorizontal: 16,
	},
	input: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 14 : 8,
		borderWidth: IS_IOS ? 0 : 1,
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		minHeight: IS_IOS ? 44 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
})
