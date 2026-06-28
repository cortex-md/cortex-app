import { z } from "zod"
import {
	BUILT_IN_PROPERTY_TYPES,
	type BuiltInPropertyType,
	type CustomPropertyType,
	type PrimitivePropertyType,
	type PropertyTypeDefinition,
	type PropertyValidationResult,
} from "./types"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const phonePattern = /^[+\d][\d\s().-]{2,}$/
const primitivePropertyTypes = new Set<PrimitivePropertyType>([
	"text",
	"number",
	"select",
	"tags",
	"person",
	"date",
	"checkbox",
	"url",
	"email",
	"phone",
])
const builtInPropertyTypes = new Set<string>(BUILT_IN_PROPERTY_TYPES)

function createValidation(schema: z.ZodType<unknown>) {
	return (value: unknown): PropertyValidationResult => {
		const result = schema.safeParse(value)
		return result.success
			? { valid: true }
			: { valid: false, message: result.error.issues[0]?.message ?? "Invalid value" }
	}
}

function identity(value: unknown): unknown {
	return value
}

function createBuiltInType(
	type: BuiltInPropertyType,
	baseType: PrimitivePropertyType,
	displayName: string,
	icon: string,
	schema: z.ZodType<unknown>,
	readOnly = false,
): PropertyTypeDefinition {
	return {
		type,
		baseType,
		displayName,
		icon,
		schema,
		readOnly,
		deserialize: identity,
		serialize: identity,
		validate: createValidation(schema),
	}
}

const stringSchema = z.string()
const nonEmptyStringSchema = z.string().min(1)
const tagsSchema = z.array(z.string())
const builtInTypes: PropertyTypeDefinition[] = [
	createBuiltInType("text", "text", "Text", "type", stringSchema),
	createBuiltInType("number", "number", "Number", "hash", z.number().finite()),
	createBuiltInType("select", "select", "Select", "circle-chevron-down", nonEmptyStringSchema),
	createBuiltInType("tags", "tags", "Tags", "tags", tagsSchema),
	createBuiltInType("person", "person", "Person", "users", stringSchema),
	createBuiltInType("date", "date", "Date", "calendar", z.string().regex(datePattern)),
	createBuiltInType("checkbox", "checkbox", "Checkbox", "square-check", z.boolean()),
	createBuiltInType("url", "url", "URL", "link", z.string().url()),
	createBuiltInType("email", "email", "Email", "mail", z.string().email()),
	createBuiltInType("phone", "phone", "Phone", "phone", z.string().regex(phonePattern)),
	createBuiltInType(
		"created_time",
		"date",
		"Created time",
		"calendar-clock",
		z.string().datetime(),
		true,
	),
	createBuiltInType("created_by", "text", "Created by", "user-round", nonEmptyStringSchema, true),
	createBuiltInType(
		"last_edited_time",
		"date",
		"Last edited time",
		"history",
		z.string().datetime(),
		true,
	),
	createBuiltInType(
		"last_edited_by",
		"text",
		"Last edited by",
		"user-round-pen",
		nonEmptyStringSchema,
		true,
	),
	createBuiltInType("id", "text", "ID", "fingerprint", nonEmptyStringSchema, true),
]

const propertyTypes = new Map<string, PropertyTypeDefinition>(
	builtInTypes.map((definition) => [definition.type, definition]),
)

export function getPropertyType(type: string): PropertyTypeDefinition | undefined {
	return propertyTypes.get(type)
}

export function getPropertyTypes(): PropertyTypeDefinition[] {
	return Array.from(propertyTypes.values())
}

export function registerPropertyType(definition: CustomPropertyType): () => void {
	const normalizedType = definition.type.trim()
	if (!normalizedType) throw new Error("Property type must have a name")
	if ((BUILT_IN_PROPERTY_TYPES as readonly string[]).includes(normalizedType)) {
		throw new Error(`Cannot replace built-in property type "${normalizedType}"`)
	}
	if (propertyTypes.has(normalizedType)) {
		throw new Error(`Property type "${normalizedType}" is already registered`)
	}
	if (!primitivePropertyTypes.has(definition.baseType)) {
		throw new Error(`Property type "${normalizedType}" has an invalid base type`)
	}
	const schema = definition.schema ?? z.unknown()
	const registered: PropertyTypeDefinition = {
		...definition,
		type: normalizedType,
		schema,
	}
	propertyTypes.set(normalizedType, registered)
	return () => {
		if (propertyTypes.get(normalizedType) === registered) propertyTypes.delete(normalizedType)
	}
}

export function resetCustomPropertyTypes(): void {
	for (const type of Array.from(propertyTypes.keys())) {
		if (!builtInPropertyTypes.has(type)) propertyTypes.delete(type)
	}
}
