import type { PluginSettingDefinition } from "@cortex.md/api"
import type { ReactNode } from "react"
import { getSettingsControls } from "./settingsControls"

interface Props {
	pluginId: string
	settings: PluginSettingDefinition[]
	values: Record<string, unknown>
	onUpdate: (key: string, value: unknown) => void
}

export function PluginSettingsRenderer({ settings, values, onUpdate }: Props) {
	const { Group } = getSettingsControls()
	const SettingsGroup = Group ?? DefaultSettingsGroup

	return (
		<SettingsGroup>
			{settings.map((setting) => (
				<SettingField
					key={setting.key}
					definition={setting}
					value={values[setting.key] ?? setting.default}
					onChange={(value) => onUpdate(setting.key, value)}
				/>
			))}
		</SettingsGroup>
	)
}

function DefaultSettingsGroup({ children }: { children: ReactNode }) {
	return <div className="flex flex-col gap-4">{children}</div>
}

interface SettingFieldProps {
	definition: PluginSettingDefinition
	value: unknown
	onChange: (value: unknown) => void
}

function SettingField({ definition, value, onChange }: SettingFieldProps) {
	const { Label, Description, Field } = getSettingsControls()
	const control = <SettingControl definition={definition} value={value} onChange={onChange} />

	if (Field) {
		return (
			<Field label={definition.label} description={definition.description}>
				{control}
			</Field>
		)
	}

	return (
		<div className="flex flex-col gap-1.5">
			<Label>{definition.label}</Label>
			{definition.description && <Description>{definition.description}</Description>}
			{control}
		</div>
	)
}

function SettingControl({ definition, value, onChange }: SettingFieldProps) {
	const { Switch, TextInput, NumberInput, Select, Slider, ColorPicker } = getSettingsControls()

	switch (definition.type) {
		case "boolean":
			return <Switch checked={value as boolean} onCheckedChange={(v) => onChange(v)} />
		case "text":
			return (
				<TextInput
					value={value as string}
					onChange={(v) => onChange(v)}
					placeholder={definition.placeholder}
				/>
			)
		case "number":
			return (
				<NumberInput
					value={normalizeNumberSettingValue(definition, value)}
					onChange={(v) => onChange(v)}
					min={definition.min}
					max={definition.max}
					step={definition.step}
				/>
			)
		case "select":
			return (
				<Select
					value={value as string}
					onChange={(v) => onChange(v)}
					options={definition.options ?? []}
				/>
			)
		case "slider":
			return (
				<Slider
					value={normalizeNumberSettingValue(definition, value)}
					onChange={(v) => onChange(v)}
					min={definition.min ?? 0}
					max={definition.max ?? 100}
					step={definition.step ?? 1}
				/>
			)
		case "color":
			return <ColorPicker value={value as string} onChange={(v) => onChange(v)} />
		case "folder-path":
			return (
				<TextInput
					value={value as string}
					onChange={(v) => onChange(v)}
					placeholder={definition.placeholder ?? "Enter path..."}
				/>
			)
		default:
			return null
	}
}

function normalizeNumberSettingValue(definition: PluginSettingDefinition, value: unknown): number {
	const fallback =
		toFiniteNumber(value) ??
		toFiniteNumber(definition.default) ??
		toFiniteNumber(definition.min) ??
		0
	const min = toFiniteNumber(definition.min)
	const max = toFiniteNumber(definition.max)
	if (min !== null && fallback < min) return min
	if (max !== null && fallback > max) return max
	return fallback
}

function toFiniteNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null
}
