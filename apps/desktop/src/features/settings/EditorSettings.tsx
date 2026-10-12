import type { EditorSettings } from "@cortex/settings"
import {
	FolderPicker,
	type FolderPickerOption,
	Input,
	NativeSelect,
	NativeSelectOption,
	Switch,
} from "@cortex/ui"
import type { UpdateSettingFn } from "."
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"

interface EditorSectionProps {
	settings: EditorSettings
	onUpdate: UpdateSettingFn
	vaultFolders?: FolderPickerOption[]
}

const emptyVaultFolders: FolderPickerOption[] = []

export function EditorSection({
	settings,
	onUpdate,
	vaultFolders = emptyVaultFolders,
}: EditorSectionProps) {
	return (
		<SettingsPage>
			<SettingsSection title="Indentation" description="Control how tabs and spaces are inserted.">
				<SettingsGroup>
					<SettingsField
						fieldId="editor.tab-size"
						htmlFor="tab-size"
						controlClassName="max-w-[120px]"
					>
						<Input
							id="tab-size"
							type="number"
							min={1}
							max={8}
							value={settings.tabSize}
							className="w-24"
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								onUpdate("editor", "tabSize", Number.parseInt(e.target.value, 10))
							}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.use-spaces" htmlFor="use-spaces">
						<Switch
							id="use-spaces"
							checked={settings.useSpaces}
							onCheckedChange={(checked) => onUpdate("editor", "useSpaces", checked)}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection title="Editor behavior" description="Adjust the default editor experience.">
				<SettingsGroup>
					<SettingsField fieldId="editor.word-wrap" htmlFor="word-wrap">
						<Switch
							id="word-wrap"
							checked={settings.wordWrap}
							onCheckedChange={(checked) => onUpdate("editor", "wordWrap", checked)}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.folding" htmlFor="folding">
						<Switch
							id="folding"
							checked={settings.folding}
							onCheckedChange={(checked) => onUpdate("editor", "folding", checked)}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.line-numbers" htmlFor="line-numbers">
						<Switch
							id="line-numbers"
							checked={settings.showLineNumbers}
							onCheckedChange={(checked) => onUpdate("editor", "showLineNumbers", checked)}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.slash-commands" htmlFor="slash-commands">
						<Switch
							id="slash-commands"
							checked={settings.slashCommands}
							onCheckedChange={(checked) => onUpdate("editor", "slashCommands", checked)}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.markdown-toolbar" htmlFor="markdown-toolbar">
						<Switch
							id="markdown-toolbar"
							checked={settings.markdownToolbar}
							onCheckedChange={(checked) => onUpdate("editor", "markdownToolbar", checked)}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.vim-mode" htmlFor="vim-mode">
						<Switch
							id="vim-mode"
							checked={settings.vimMode}
							onCheckedChange={(checked) => onUpdate("editor", "vimMode", checked)}
						/>
					</SettingsField>

					<SettingsField fieldId="editor.auto-save" htmlFor="auto-save">
						<Switch
							id="auto-save"
							checked={settings.autoSave}
							onCheckedChange={(checked) => onUpdate("editor", "autoSave", checked)}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection
				title="Images"
				description="Choose where pasted and dropped images are stored."
			>
				<SettingsGroup>
					<SettingsField fieldId="editor.image-storage" htmlFor="image-storage">
						<NativeSelect
							id="image-storage"
							value={settings.imageStorageLocation}
							onChange={(event) => onUpdate("editor", "imageStorageLocation", event.target.value)}
						>
							<NativeSelectOption value="same">Same folder as note</NativeSelectOption>
							<NativeSelectOption value="root">Vault root</NativeSelectOption>
							<NativeSelectOption value="custom">Custom folder</NativeSelectOption>
						</NativeSelect>
					</SettingsField>

					{settings.imageStorageLocation === "custom" && (
						<SettingsField fieldId="editor.image-folder" controlClassName="max-w-[360px]">
							<FolderPicker
								options={vaultFolders}
								value={settings.imageStorageCustomPath}
								onChange={(value) => onUpdate("editor", "imageStorageCustomPath", value)}
								placeholder="Select a folder..."
							/>
						</SettingsField>
					)}
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
