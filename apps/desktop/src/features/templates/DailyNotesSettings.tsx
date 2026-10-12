import type { TemplateDefinition } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { FolderPicker, Input, NativeSelect, NativeSelectOption } from "@cortex/ui"
import { SettingsField, SettingsGroup, SettingsSection } from "../settings/SettingsPrimitives"
import { useSettingsVaultFolders } from "../settings/useSettingsVaultFiles"

interface DailyNotesSettingsProps {
	templates: TemplateDefinition[]
}

export function DailyNotesSettings({ templates }: DailyNotesSettingsProps) {
	const settings = useSettingsStore((state) => state.settings.dailyNotes)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	const vaultFolders = useSettingsVaultFolders()

	return (
		<SettingsSection
			title="Daily notes"
			description="Choose where and how daily notes are created."
		>
			<SettingsGroup>
				<SettingsField fieldId="templates.daily-folder" controlClassName="max-w-[360px]">
					<FolderPicker
						options={vaultFolders}
						value={settings.folder}
						onChange={(value) => updateSetting("dailyNotes", "folder", value)}
						placeholder="Vault root"
						allowCustomValue
						reserveDropdownSpace
					/>
				</SettingsField>
				<SettingsField
					fieldId="templates.daily-format"
					htmlFor="daily-note-format"
					controlClassName="max-w-[200px]"
				>
					<Input
						key={settings.format}
						id="daily-note-format"
						defaultValue={settings.format}
						onBlur={(event) => {
							const format = event.target.value.trim()
							if (format && format !== settings.format) {
								void updateSetting("dailyNotes", "format", format)
							}
						}}
					/>
				</SettingsField>
				<SettingsField fieldId="templates.daily-template" htmlFor="daily-note-template">
					<NativeSelect
						id="daily-note-template"
						value={settings.templateId}
						onChange={(event) => updateSetting("dailyNotes", "templateId", event.target.value)}
					>
						<NativeSelectOption value="">None</NativeSelectOption>
						{templates.map((template) => (
							<NativeSelectOption key={template.id} value={template.id}>
								{template.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}
