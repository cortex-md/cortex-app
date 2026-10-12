import type {
	PluginSettingDefinition,
	PluginSettingsSchema,
	PluginSettingValue,
} from "@cortex.md/api"

type ToSettingField<Definition> = Definition extends PluginSettingDefinition
	? Definition & { key: string; value: PluginSettingValue<Definition> }
	: never

export type PluginSettingField = ToSettingField<PluginSettingDefinition>

type NumericSettingDefinition = Extract<PluginSettingDefinition, { type: "number" | "slider" }>

function toFiniteNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clampNumberSetting(definition: NumericSettingDefinition, value: unknown): number {
	const number = toFiniteNumber(value) ?? toFiniteNumber(definition.default) ?? definition.min ?? 0
	if (definition.min !== undefined && number < definition.min) return definition.min
	if (definition.max !== undefined && number > definition.max) return definition.max
	return number
}

function resolveSettingField(
	key: string,
	definition: PluginSettingDefinition,
	value: unknown,
): PluginSettingField {
	switch (definition.type) {
		case "boolean":
			return { ...definition, key, value: value === true }
		case "number":
		case "slider":
			return { ...definition, key, value: clampNumberSetting(definition, value) }
		default:
			return { ...definition, key, value: String(value ?? "") }
	}
}

export function resolvePluginSettingFields(
	schema: PluginSettingsSchema,
	values: Record<string, unknown>,
): PluginSettingField[] {
	return Object.entries(schema).map(([key, definition]) =>
		resolveSettingField(key, definition, values[key] ?? definition.default),
	)
}
