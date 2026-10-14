import type { TemplateDefinition } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"

import { FormSection } from "@/components/ui/Form"
import { PropertyPicker, PropertyTextField } from "@/features/properties/PropertyControls"

const NO_TEMPLATE = ""

export function DailyNotesSection({ templates }: { templates: readonly TemplateDefinition[] }) {
	const settings = useSettingsStore((state) => state.settings.dailyNotes)
	const updateSetting = useSettingsStore((state) => state.updateSetting)

	return (
		<FormSection footer="Where and how daily notes are created." title="Daily notes">
			<PropertyTextField
				initialValue={settings.folder}
				key={`folder-${settings.folder}`}
				keyboard="url"
				label="Folder"
				onCommit={(value) => {
					const folder = value.trim()
					if (folder !== settings.folder) void updateSetting("dailyNotes", "folder", folder)
				}}
				placeholder="Vault root"
			/>
			<PropertyTextField
				initialValue={settings.format}
				key={`format-${settings.format}`}
				keyboard="url"
				label="Date format"
				onCommit={(value) => {
					const format = value.trim()
					if (format && format !== settings.format) {
						void updateSetting("dailyNotes", "format", format)
					}
				}}
				placeholder="YYYY-MM-DD"
			/>
			<PropertyPicker
				icon={{ sf: "doc.on.doc", md: "dashboard_customize" }}
				onChange={(value) => void updateSetting("dailyNotes", "templateId", value)}
				options={[
					{ label: "None", value: NO_TEMPLATE },
					...templates.map((template) => ({ label: template.name, value: template.id })),
				]}
				title="Template"
				value={settings.templateId}
			/>
		</FormSection>
	)
}
