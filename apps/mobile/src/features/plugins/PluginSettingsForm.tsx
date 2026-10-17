import {
	type PluginSettingField,
	reportPluginOperationError,
	resolvePluginSettingFields,
	usePluginStore,
} from "@cortex/plugin-host-core"
import type { PluginSettingsSchema } from "@cortex.md/api"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { FormSection, FormToggle } from "@/components/ui/Form"
import {
	SettingsPicker,
	SettingsSlider,
	SettingsTextField,
} from "@/features/settings/SettingsControls"

const emptyValues: Record<string, unknown> = {}

function updatePluginSetting(owner: string, key: string, value: unknown): void {
	void mobilePluginHost
		.setPluginSetting(owner, key, value)
		.catch((cause: unknown) => reportPluginOperationError(`setting:${key}`, owner, cause))
}

function toNumberSetting(text: string): number | null {
	const value = Number(text)
	return text.trim() !== "" && Number.isFinite(value) ? value : null
}

function PluginSettingRow({
	field,
	onChange,
}: {
	field: PluginSettingField
	onChange: (value: unknown) => void
}) {
	switch (field.type) {
		case "boolean":
			return (
				<FormToggle
					onValueChange={onChange}
					subtitle={field.description}
					title={field.label}
					value={field.value}
				/>
			)
		case "select":
			return (
				<SettingsPicker
					onChange={(value) => onChange(String(value))}
					options={field.options}
					title={field.label}
					value={field.value}
				/>
			)
		case "slider":
			return (
				<SettingsSlider
					max={field.max ?? 100}
					min={field.min ?? 0}
					onChange={onChange}
					step={field.step ?? 1}
					title={field.label}
					value={field.value}
					valueLabel={String(field.value)}
				/>
			)
		case "number":
			return (
				<SettingsTextField
					defaultValue={String(field.value)}
					key={field.value}
					numeric
					onCommit={(text) => {
						const value = toNumberSetting(text)
						if (value !== null && value !== field.value) onChange(value)
					}}
					subtitle={field.description}
					title={field.label}
				/>
			)
		default:
			return (
				<SettingsTextField
					defaultValue={field.value}
					key={field.value}
					onCommit={(text) => {
						if (text !== field.value) onChange(text)
					}}
					placeholder={
						field.placeholder ?? (field.type === "folder-path" ? "Enter path..." : undefined)
					}
					subtitle={field.description}
					title={field.label}
				/>
			)
	}
}

export function PluginSettingsForm({
	owner,
	schema,
}: {
	owner: string
	schema: PluginSettingsSchema
}) {
	const values = usePluginStore((state) => state.settingsValues[owner]) ?? emptyValues

	return (
		<FormSection>
			{resolvePluginSettingFields(schema, values).map((field) => (
				<PluginSettingRow
					field={field}
					key={field.key}
					onChange={(value) => updatePluginSetting(owner, field.key, value)}
				/>
			))}
		</FormSection>
	)
}
