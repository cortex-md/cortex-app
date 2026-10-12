import {
	type PluginSettingField,
	reportPluginOperationError,
	resolvePluginSettingFields,
	usePluginStore,
} from "@cortex/plugin-host-core"
import type { PluginSettingsSchema } from "@cortex.md/api"
import { FieldGroup, ListItem, Picker, Slider, Switch } from "@expo/ui"

import { mobilePluginHost } from "@/bootstrap/pluginHost"
import { MobileTextField } from "@/components/ui/MobileTextField"

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
				<ListItem
					supportingText={field.description}
					trailing={<Switch label={field.label} onValueChange={onChange} value={field.value} />}
				>
					{field.label}
				</ListItem>
			)
		case "select":
			return (
				<ListItem
					supportingText={field.description}
					trailing={
						<Picker onValueChange={(value) => onChange(String(value))} selectedValue={field.value}>
							{field.options.map((option) => (
								<Picker.Item key={option.value} label={option.label} value={option.value} />
							))}
						</Picker>
					}
				>
					{field.label}
				</ListItem>
			)
		case "slider":
			return (
				<>
					<ListItem
						supportingText={
							field.description ? `${field.description} · ${field.value}` : String(field.value)
						}
					>
						{field.label}
					</ListItem>
					<Slider
						max={field.max ?? 100}
						min={field.min ?? 0}
						onValueChange={onChange}
						step={field.step ?? 1}
						value={field.value}
					/>
				</>
			)
		case "number":
			return (
				<>
					<ListItem supportingText={field.description}>{field.label}</ListItem>
					<MobileTextField
						accessibilityLabel={field.label}
						defaultValue={String(field.value)}
						key={field.value}
						keyboardType="decimal-pad"
						onEndEditing={(event) => {
							const value = toNumberSetting(event.nativeEvent.text)
							if (value !== null && value !== field.value) onChange(value)
						}}
						returnKeyType="done"
					/>
				</>
			)
		default:
			return (
				<>
					<ListItem supportingText={field.description}>{field.label}</ListItem>
					<MobileTextField
						accessibilityLabel={field.label}
						autoCapitalize="none"
						autoCorrect={false}
						defaultValue={field.value}
						key={field.value}
						onEndEditing={(event) => {
							if (event.nativeEvent.text !== field.value) onChange(event.nativeEvent.text)
						}}
						placeholder={
							field.placeholder ?? (field.type === "folder-path" ? "Enter path..." : undefined)
						}
						returnKeyType="done"
					/>
				</>
			)
	}
}

export function PluginSettingsForm({
	owner,
	schema,
	title,
}: {
	owner: string
	schema: PluginSettingsSchema
	title: string
}) {
	const values = usePluginStore((state) => state.settingsValues[owner]) ?? emptyValues

	return (
		<FieldGroup.Section title={title}>
			{resolvePluginSettingFields(schema, values).map((field) => (
				<PluginSettingRow
					field={field}
					key={field.key}
					onChange={(value) => updatePluginSetting(owner, field.key, value)}
				/>
			))}
		</FieldGroup.Section>
	)
}
