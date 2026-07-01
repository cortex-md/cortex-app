import type { PrimitivePropertyType, PropertyDefinition, PropertyMap, VaultSchema } from "../types"

export const INTERNAL_PROPERTY_KEYS = new Set(["cortex-databases"])

export const EXCLUDED_OBSERVED_PROPERTY_KEYS = new Set([
	"tags",
	"aliases",
	"cortex-tags",
	...INTERNAL_PROPERTY_KEYS,
])

export function isObservablePropertyValue(value: unknown): boolean {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value instanceof Date
	)
}

function inferObservedPropertyType(value: unknown): PrimitivePropertyType {
	if (typeof value === "boolean") return "checkbox"
	if (typeof value === "number") return "number"
	if (value instanceof Date) return "date"
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return "date"
	if (typeof value === "string" && /^https?:\/\//i.test(value)) return "url"
	if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email"
	return "text"
}

export function createObservedPropertyDefinition(key: string, value: unknown): PropertyDefinition {
	return {
		id: `observed:${key}`,
		key,
		name: key.replaceAll(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
		type: inferObservedPropertyType(value),
		createdAt: new Date(0).toISOString(),
		observed: true,
	}
}

export function getObservedPropertyDefinitions(
	meta: PropertyMap,
	schema: VaultSchema,
): PropertyDefinition[] {
	const definedKeys = new Set(
		schema.properties.map((definition) => definition.key.toLocaleLowerCase()),
	)
	const observed: PropertyDefinition[] = []
	for (const [key, value] of Object.entries(meta)) {
		const normalizedKey = key.toLocaleLowerCase()
		if (
			definedKeys.has(normalizedKey) ||
			EXCLUDED_OBSERVED_PROPERTY_KEYS.has(normalizedKey) ||
			!isObservablePropertyValue(value)
		) {
			continue
		}
		observed.push(createObservedPropertyDefinition(key, value))
	}
	return observed
}
