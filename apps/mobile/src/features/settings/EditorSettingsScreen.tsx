import { useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { type EditorSettings, useSettingsStore } from "@cortex/settings"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { SettingsPicker } from "@/features/settings/SettingsControls"
import type { SettingsOption } from "@/features/settings/settingsControlTypes"
import { updateSetting } from "@/features/settings/settingsPages"

type ImageLocation = EditorSettings["imageStorageLocation"]

const TAB_SIZES: SettingsOption<number>[] = [2, 4, 8].map((size) => ({
	label: String(size),
	value: size,
}))

const IMAGE_LOCATIONS: SettingsOption<ImageLocation>[] = [
	{ label: "Same folder as the note", value: "same" },
	{ label: "Vault root", value: "root" },
	{ label: "Custom folder", value: "custom" },
]

async function pickImageFolder(): Promise<void> {
	const folder = await getPlatform().dialog.pickFolder({ title: "Image folder" })
	if (folder) updateSetting("editor", "imageStorageCustomPath", folder)
}

function trimSlashes(value: string): string {
	return value.replace(/^\/+|\/+$/g, "")
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function folderLabel(path: string, vaultPath: string | undefined, vaultName: string): string {
	const decoded = safeDecode(path)
	if (vaultPath && decoded.startsWith(vaultPath)) {
		return trimSlashes(decoded.slice(vaultPath.length)) || vaultName
	}
	return trimSlashes(decoded).split(/[/:]/).pop() || decoded
}

export function EditorSettingsScreen() {
	const editor = useSettingsStore((state) => state.settings.editor)
	const vault = useVaultStore((state) => state.vault)
	const customFolder = editor.imageStorageCustomPath
		? folderLabel(editor.imageStorageCustomPath, vault?.path, vault?.name ?? "Vault")
		: "Choose…"

	return (
		<NativeForm>
			<FormSection title="Editing">
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "wordWrap", value)}
					title="Word wrap"
					value={editor.wordWrap}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "folding", value)}
					title="Fold sections"
					value={editor.folding}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "showLineNumbers", value)}
					title="Line numbers"
					value={editor.showLineNumbers}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "slashCommands", value)}
					title="Slash commands"
					value={editor.slashCommands}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "markdownToolbar", value)}
					title="Markdown toolbar"
					value={editor.markdownToolbar}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "autoSave", value)}
					title="Auto-save"
					value={editor.autoSave}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "vimMode", value)}
					subtitle="With a hardware keyboard"
					title="Vim mode"
					value={editor.vimMode}
				/>
			</FormSection>
			<FormSection title="Indentation">
				<SettingsPicker
					onChange={(value) => updateSetting("editor", "tabSize", value)}
					options={TAB_SIZES}
					title="Tab size"
					value={editor.tabSize}
				/>
				<FormToggle
					onValueChange={(value) => updateSetting("editor", "useSpaces", value)}
					title="Use spaces"
					value={editor.useSpaces}
				/>
			</FormSection>
			<FormSection title="Images">
				<SettingsPicker
					onChange={(value) => updateSetting("editor", "imageStorageLocation", value)}
					options={IMAGE_LOCATIONS}
					title="Save images in"
					value={editor.imageStorageLocation}
				/>
				{editor.imageStorageLocation === "custom" ? (
					<FormRow
						chevron
						onPress={() => void pickImageFolder()}
						title="Folder"
						value={customFolder}
					/>
				) : null}
			</FormSection>
		</NativeForm>
	)
}
