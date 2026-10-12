import { type PluginSettingField, resolvePluginSettingFields } from "@cortex/plugin-host-core"
import type { PluginSettingsSchema } from "@cortex.md/api"
import type { ComponentType, ReactNode } from "react"

export interface SettingsControlComponents {
	Group?: ComponentType<{ children: ReactNode }>
	Field?: ComponentType<{
		fieldId?: string
		label: ReactNode
		description?: ReactNode
		children: ReactNode
	}>
	Switch: ComponentType<{ checked: boolean; onCheckedChange: (value: boolean) => void }>
	TextInput: ComponentType<{
		value: string
		onChange: (value: string) => void
		placeholder?: string
	}>
	NumberInput: ComponentType<{
		value: number
		onChange: (value: number) => void
		min?: number
		max?: number
		step?: number
	}>
	Select: ComponentType<{
		value: string
		onChange: (value: string) => void
		options: readonly { value: string; label: string }[]
	}>
	Slider: ComponentType<{
		value: number
		onChange: (value: number) => void
		min: number
		max: number
		step: number
	}>
	ColorPicker: ComponentType<{ value: string; onChange: (value: string) => void }>
	Label: ComponentType<{ children: ReactNode }>
	Description: ComponentType<{ children: ReactNode }>
}

interface Props {
	schema: PluginSettingsSchema
	values: Record<string, unknown>
	controls: SettingsControlComponents
	onUpdate: (key: string, value: unknown) => void
	fieldIdPrefix?: string
}

export function PluginSettingsRenderer({
	schema,
	values,
	controls,
	onUpdate,
	fieldIdPrefix,
}: Props) {
	const SettingsGroup = controls.Group ?? DefaultSettingsGroup

	return (
		<SettingsGroup>
			{resolvePluginSettingFields(schema, values).map((field) => (
				<SettingField
					key={field.key}
					fieldId={fieldIdPrefix ? `${fieldIdPrefix}${field.key}` : undefined}
					field={field}
					controls={controls}
					onChange={(value) => onUpdate(field.key, value)}
				/>
			))}
		</SettingsGroup>
	)
}

function DefaultSettingsGroup({ children }: { children: ReactNode }) {
	return <div className="flex flex-col gap-4">{children}</div>
}

interface SettingFieldProps {
	fieldId?: string
	field: PluginSettingField
	controls: SettingsControlComponents
	onChange: (value: unknown) => void
}

function SettingField(props: SettingFieldProps) {
	const { field, controls, fieldId } = props
	const { Label, Description, Field } = controls
	const control = <SettingControl {...props} />

	if (Field) {
		return (
			<Field fieldId={fieldId} label={field.label} description={field.description}>
				{control}
			</Field>
		)
	}

	return (
		<div className="flex flex-col gap-1.5">
			<Label>{field.label}</Label>
			{field.description && <Description>{field.description}</Description>}
			{control}
		</div>
	)
}

function SettingControl({ field, controls, onChange }: SettingFieldProps) {
	const { Switch, TextInput, NumberInput, Select, Slider, ColorPicker } = controls

	switch (field.type) {
		case "boolean":
			return <Switch checked={field.value} onCheckedChange={onChange} />
		case "text":
		case "folder-path":
			return (
				<TextInput
					value={field.value}
					onChange={onChange}
					placeholder={
						field.placeholder ?? (field.type === "folder-path" ? "Enter path..." : undefined)
					}
				/>
			)
		case "number":
			return (
				<NumberInput
					value={field.value}
					onChange={onChange}
					min={field.min}
					max={field.max}
					step={field.step}
				/>
			)
		case "select":
			return <Select value={field.value} onChange={onChange} options={field.options} />
		case "slider":
			return (
				<Slider
					value={field.value}
					onChange={onChange}
					min={field.min ?? 0}
					max={field.max ?? 100}
					step={field.step ?? 1}
				/>
			)
		case "color":
			return <ColorPicker value={field.value} onChange={onChange} />
		default:
			return null
	}
}
