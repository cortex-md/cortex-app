import type { SyncPreferences } from "@cortex/platform"
import { useState } from "react"
import { Alert, Platform } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { FormButton, FormHeader } from "@/features/onboarding/FormControls"

type ToggleKey = "ignoreImages" | "syncSettings" | "syncWorkspace" | "syncBookmarks"

const toggleRows: { key: ToggleKey; label: string; icon: SymbolName }[] = [
	{ icon: { md: "image", sf: "photo" }, key: "ignoreImages", label: "Ignore images" },
	{
		icon: { md: "tune", sf: "slider.horizontal.3" },
		key: "syncSettings",
		label: "Sync app settings",
	},
	{
		icon: { md: "dashboard", sf: "rectangle.split.2x1" },
		key: "syncWorkspace",
		label: "Sync workspace layout",
	},
	{ icon: { md: "bookmark", sf: "bookmark" }, key: "syncBookmarks", label: "Sync bookmarks" },
]

const ADD_PATH_MESSAGE = "A folder, a file, or a pattern such as *.pdf"

function pathSymbol(path: string): SymbolName {
	return path.includes("*") || path.includes(".")
		? { md: "description", sf: "doc" }
		: { md: "folder", sf: "folder" }
}

export function OnboardingSync({
	busy,
	onBack,
	onChange,
	onCreate,
	preferences,
	showTitle,
}: {
	busy: boolean
	onBack: () => void
	onChange: (preferences: SyncPreferences) => void
	onCreate: () => void
	preferences: SyncPreferences
	showTitle: boolean
}) {
	const [addingPath, setAddingPath] = useState(false)

	function addExcludedPath(value: string) {
		setAddingPath(false)
		const path = value.trim()
		if (!path || preferences.excludedPaths.includes(path)) return
		onChange({ ...preferences, excludedPaths: [...preferences.excludedPaths, path] })
	}

	function promptExcludedPath() {
		if (Platform.OS !== "ios") {
			setAddingPath(true)
			return
		}
		Alert.prompt("Add path", ADD_PATH_MESSAGE, [
			{ style: "cancel", text: "Cancel" },
			{ onPress: (value?: string) => addExcludedPath(value ?? ""), text: "Add" },
		])
	}

	function confirmRemove(path: string) {
		Alert.alert(`Remove “${path}”?`, undefined, [
			{ style: "cancel", text: "Cancel" },
			{
				onPress: () =>
					onChange({
						...preferences,
						excludedPaths: preferences.excludedPaths.filter((candidate) => candidate !== path),
					}),
				style: "destructive",
				text: "Remove",
			},
		])
	}

	return (
		<>
			<NativeForm>
				{showTitle ? (
					<FormSection>
						<FormHeader title="Sync preferences" />
					</FormSection>
				) : null}
				<FormSection title="Sync">
					{toggleRows.map((row) => (
						<FormToggle
							icon={row.icon}
							key={row.key}
							onValueChange={(value) => onChange({ ...preferences, [row.key]: value })}
							title={row.label}
							value={preferences[row.key]}
						/>
					))}
				</FormSection>
				<FormSection footer="Excluded files and folders are never uploaded." title="Excluded paths">
					{preferences.excludedPaths.map((path) => (
						<FormRow
							icon={pathSymbol(path)}
							key={path}
							onPress={() => confirmRemove(path)}
							title={path}
						/>
					))}
					<FormRow
						icon={{ md: "add", sf: "plus" }}
						onPress={promptExcludedPath}
						tint
						title="Add path"
					/>
				</FormSection>
				<FormSection>
					<FormButton
						disabled={busy}
						label={busy ? "Creating…" : "Create vault"}
						onPress={onCreate}
					/>
					<FormButton disabled={busy} label="Back" onPress={onBack} variant="plain" />
				</FormSection>
			</NativeForm>
			{Platform.OS === "ios" ? null : (
				<TextPromptDialog
					confirmLabel="Add"
					key={addingPath ? "open" : "closed"}
					message={ADD_PATH_MESSAGE}
					onCancel={() => setAddingPath(false)}
					onConfirm={addExcludedPath}
					placeholder="Archive"
					title="Add path"
					visible={addingPath}
				/>
			)}
		</>
	)
}
