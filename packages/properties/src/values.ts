import { getPropertyType } from "./registry"
import type {
	PrimitivePropertyType,
	PropertyDefinition,
	PropertyOption,
	ResolvedPropertyActor,
} from "./types"

export function isEmptyPropertyValue(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	)
}

const MULTIPLE_VALUE_TYPES = new Set(["select", "person"])

export function supportsMultipleValues(type: string): boolean {
	const baseType = getPropertyType(type)?.baseType
	return baseType !== undefined && MULTIPLE_VALUE_TYPES.has(baseType)
}

export function allowsMultipleValues(definition: PropertyDefinition): boolean {
	return definition.multiple === true && supportsMultipleValues(definition.type)
}

export function getPropertyValueList(value: unknown): unknown[] {
	if (isEmptyPropertyValue(value)) return []
	return Array.isArray(value) ? value : [value]
}

export function togglePropertyValue(
	definition: PropertyDefinition,
	current: unknown,
	item: string,
): unknown {
	if (!allowsMultipleValues(definition)) return item
	const values = getPropertyValueList(current).map(String)
	return values.includes(item) ? values.filter((value) => value !== item) : [...values, item]
}

export function getPropertyValueHref(type: string, value: unknown): string | null {
	if (typeof value !== "string" || !value.trim()) return null
	const text = value.trim()
	const baseType = getPropertyType(type)?.baseType ?? type
	if (baseType === "url") return /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`
	if (baseType === "email") return `mailto:${text}`
	if (baseType === "phone") return `tel:${text.replace(/[^\d+]/g, "")}`
	return null
}

export function resolvePropertyOption(
	definition: PropertyDefinition,
	value: unknown,
): PropertyOption {
	return (
		definition.options?.find((option) => option.id === value) ?? {
			id: String(value ?? ""),
			label: "Unknown",
			color: "gray",
		}
	)
}

export function isResolvedPropertyActor(value: unknown): value is ResolvedPropertyActor {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		typeof (value as ResolvedPropertyActor).kind === "string"
	)
}

export function parsePropertyDate(value: unknown): Date | undefined {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
	const [year, month, day] = value.split("-").map(Number)
	const date = new Date(year, month - 1, day)
	if (
		Number.isNaN(date.getTime()) ||
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return undefined
	}
	return date
}

export function serializePropertyDate(value: Date): string {
	const year = value.getFullYear()
	const month = String(value.getMonth() + 1).padStart(2, "0")
	const day = String(value.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

export function parsePropertyInput(baseType: PrimitivePropertyType, value: string): unknown {
	if (value === "") return ""
	return baseType === "number" ? Number(value) : value
}

export type PropertyDraftResolution =
	| { kind: "remove" }
	| { kind: "set"; value: unknown }
	| { kind: "invalid"; message: string }

export type PropertyInputType = "number" | "email" | "url" | "tel" | "text"

const propertyInputTypes: Partial<Record<PrimitivePropertyType, PropertyInputType>> = {
	number: "number",
	email: "email",
	url: "url",
	phone: "tel",
}

export function getPropertyInputType(type: string): PropertyInputType {
	const baseType = getPropertyType(type)?.baseType ?? "text"
	return propertyInputTypes[baseType] ?? "text"
}

export function resolveTextPropertyDraft(type: string, draft: string): PropertyDraftResolution {
	const propertyType = getPropertyType(type)
	const value = parsePropertyInput(propertyType?.baseType ?? "text", draft.trim())
	if (isEmptyPropertyValue(value)) return { kind: "remove" }
	const validation = propertyType?.validate(value)
	if (validation && !validation.valid) {
		return { kind: "invalid", message: validation.message ?? "Invalid value" }
	}
	return { kind: "set", value }
}
