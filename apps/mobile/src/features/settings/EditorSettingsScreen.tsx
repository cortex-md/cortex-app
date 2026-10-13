import { formatVaultPath } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { type EditorSettings, useSettingsStore } from "@cortex/settings"
import { ListItem, Picker, Text } from "@expo/ui"
import { Platform } from "react-native"

import { SettingsRow } from "@/components/ui/SettingsRow"
import {
	SettingsBlock,
	SettingsFooter,
	SettingsScroll,
	SettingsSection,
} from "@/features/settings/SettingsLayout"
import { updateSetting } from "@/features/settings/settingsPages"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

const TAB_SIZES = [2, 4, 8]

const imageLocationLabels: Record<EditorSettings["imageStorageLocation"], string> = {
	custom: "Custom folder",
	root: "Vault root",
	same: "Same folder as the note",
}

const imageLocations = Object.keys(imageLocationLabels) as EditorSettings["imageStorageLocation"][]

async function pickImageFolder(): Promise<void> {
	const folder = await getPlatform().dialog.pickFolder({ title: "Custom image folder" })
	if (folder) updateSetting("editor", "imageStorageCustomPath", folder)
}

export function EditorSettingsScreen() {
	const { colors } = useMobileColors()
	const editor = useSettingsStore((state) => state.settings.editor)
	const customFolder = editor.imageStorageCustomPath
		? formatVaultPath(editor.imageStorageCustomPath)
		: "Select a folder..."

	return (
		<SettingsScroll>
			<SettingsSection title="Editor behavior">
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "wordWrap", value)}
					title="Word wrap"
					toggled={editor.wordWrap}
				/>
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "folding", value)}
					subtitle="Show folding controls for headings, lists, quotes, and code blocks."
					title="Fold sections"
					toggled={editor.folding}
				/>
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "showLineNumbers", value)}
					title="Show line numbers"
					toggled={editor.showLineNumbers}
				/>
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "slashCommands", value)}
					subtitle="Show Markdown actions after typing / in the editor."
					title="Slash commands"
					toggled={editor.slashCommands}
				/>
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "markdownToolbar", value)}
					subtitle="Show common formatting controls above the keyboard."
					title="Markdown toolbar"
					toggled={editor.markdownToolbar}
				/>
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "vimMode", value)}
					subtitle="Use Vim motions with a hardware keyboard."
					title="Vim mode"
					toggled={editor.vimMode}
				/>
				<SettingsRow
					onToggle={(value) => updateSetting("editor", "autoSave", value)}
					title="Auto-save"
					toggled={editor.autoSave}
				/>
			</SettingsSection>

			<SettingsBlock>
				<SettingsSection title="Indentation">
					<ListItem
						colors={{ containerColor: colors.cell, contentColor: colors.label }}
						trailing={
							<Picker
								onValueChange={(value) => updateSetting("editor", "tabSize", Number(value))}
								selectedValue={String(editor.tabSize)}
							>
								{TAB_SIZES.map((size) => (
									<Picker.Item key={size} label={String(size)} value={String(size)} />
								))}
							</Picker>
						}
					>
						<Text textStyle={{ color: colors.label }}>Tab size</Text>
					</ListItem>
					<SettingsRow
						onToggle={(value) => updateSetting("editor", "useSpaces", value)}
						title="Use spaces instead of tabs"
						toggled={editor.useSpaces}
					/>
				</SettingsSection>
			</SettingsBlock>

			<SettingsBlock>
				<SettingsSection title="Images">
					<ListItem
						colors={{ containerColor: colors.cell, contentColor: colors.label }}
						supportingText={IS_IOS ? undefined : imageLocationLabels[editor.imageStorageLocation]}
						trailing={
							<Picker
								onValueChange={(value) => updateSetting("editor", "imageStorageLocation", value)}
								selectedValue={editor.imageStorageLocation}
							>
								{imageLocations.map((location) => (
									<Picker.Item key={location} label={imageLocationLabels[location]} value={location} />
								))}
							</Picker>
						}
					>
						<Text textStyle={{ color: colors.label }}>Image storage location</Text>
					</ListItem>
					<SettingsRow
						chevron
						disabled={editor.imageStorageLocation !== "custom"}
						onPress={() => void pickImageFolder()}
						title="Custom image folder"
						value={customFolder}
					/>
				</SettingsSection>
				<SettingsFooter>Images will be saved relative to the active vault.</SettingsFooter>
			</SettingsBlock>
		</SettingsScroll>
	)
}
