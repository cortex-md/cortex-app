import { z } from "zod"
import { getPropertyType } from "./registry"
import {
	type CreatePropertyDefinitionInput,
	PROPERTY_COLORS,
	type PropertyColor,
	type PropertyDefinition,
	type PropertyFactoryOptions,
	type PropertyOption,
	type VaultSchema,
} from "./types"

const propertyOptionSchema = z.object({
	id: z.string().uuid(),
	label: z.string().trim().min(1),
	color: z.enum(PROPERTY_COLORS),
})

const propertyDefinitionSchema = z.object({
	id: z.string().uuid(),
	key: z.string().trim().min(1),
	name: z.string().trim().min(1),
	type: z.string().trim().min(1),
	createdAt: z.string().datetime(),
	options: z.array(propertyOptionSchema).optional(),
	defaultOptionId: z.string().uuid().optional(),
	optionSort: z.enum(["manual", "alphabetical"]).optional(),
})

const vaultSchemaSchema = z.object({
	version: z.literal(1),
	properties: z.array(propertyDefinitionSchema),
})

function createUniquePropertyName(name: string, properties: readonly PropertyDefinition[]): string {
	const names = new Set(properties.map((property) => property.name.toLocaleLowerCase()))
	const copyName = `${name} copy`
	if (!names.has(copyName.toLocaleLowerCase())) return copyName
	let suffix = 2
	while (names.has(`${copyName} ${suffix}`.toLocaleLowerCase())) suffix++
	return `${copyName} ${suffix}`
}

function assertUniqueDefinitions(properties: PropertyDefinition[]): void {
	const ids = new Set<string>()
	const keys = new Set<string>()
	const names = new Set<string>()
	for (const property of properties) {
		const key = property.key.toLocaleLowerCase()
		const name = property.name.toLocaleLowerCase()
		if (ids.has(property.id)) throw new Error(`Duplicate property id "${property.id}"`)
		if (keys.has(key)) throw new Error(`Duplicate property key "${property.key}"`)
		if (names.has(name)) throw new Error(`Duplicate property name "${property.name}"`)
		ids.add(property.id)
		keys.add(key)
		names.add(name)
	}
}

function validateOptions(definition: PropertyDefinition): void {
	const baseType = getPropertyType(definition.type)?.baseType
	if (baseType !== "select") return
	const options = definition.options ?? []
	const optionIds = new Set<string>()
	for (const option of options) {
		propertyOptionSchema.parse(option)
		if (optionIds.has(option.id)) throw new Error(`Duplicate property option id "${option.id}"`)
		optionIds.add(option.id)
	}
	if (definition.defaultOptionId && !optionIds.has(definition.defaultOptionId)) {
		throw new Error(`Unknown default select option "${definition.defaultOptionId}"`)
	}
}

export function defineProperty(definition: PropertyDefinition): PropertyDefinition {
	const parsed = propertyDefinitionSchema.parse(definition) as PropertyDefinition
	if (parsed.key.toLocaleLowerCase() === "author" && parsed.type !== "text") {
		throw new Error('The reserved "author" property must use the text type')
	}
	const propertyType = getPropertyType(parsed.type)
	if (parsed.defaultOptionId && propertyType && propertyType.baseType !== "select") {
		throw new Error("Only select properties can define a default option")
	}
	validateOptions(parsed)
	return {
		...parsed,
		key: parsed.key.trim(),
		name: parsed.name.trim(),
		options: parsed.options?.map((option) => ({ ...option })),
	}
}

export function createPropertyKey(name: string, properties: readonly PropertyDefinition[]): string {
	const baseKey =
		name
			.trim()
			.toLocaleLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "property"
	const keys = new Set(properties.map((property) => property.key.toLocaleLowerCase()))
	if (!keys.has(baseKey)) return baseKey
	let suffix = 2
	while (keys.has(`${baseKey}-${suffix}`)) suffix++
	return `${baseKey}-${suffix}`
}

export function createPropertyDefinition(
	input: CreatePropertyDefinitionInput,
	options: PropertyFactoryOptions = {},
): PropertyDefinition {
	const properties = input.properties ?? []
	const key = input.key ?? createPropertyKey(input.name, properties)
	const type = key === "author" ? "text" : input.type
	const select = getPropertyType(type)?.baseType === "select"
	return defineProperty({
		id: (options.createId ?? (() => crypto.randomUUID()))(),
		key,
		name: input.name,
		type,
		createdAt: (options.now ?? (() => new Date()))().toISOString(),
		options: select ? (input.options ?? []) : undefined,
		defaultOptionId: select ? input.defaultOptionId : undefined,
		optionSort: select ? (input.optionSort ?? "manual") : undefined,
	})
}

export function createPropertyOption(
	label: string,
	existingOptions: readonly PropertyOption[] = [],
	options: PropertyFactoryOptions = {},
	color?: PropertyColor,
): PropertyOption {
	return propertyOptionSchema.parse({
		id: (options.createId ?? (() => crypto.randomUUID()))(),
		label,
		color: color ?? PROPERTY_COLORS[existingOptions.length % PROPERTY_COLORS.length],
	}) as PropertyOption
}

export function updatePropertyOption(
	definition: PropertyDefinition,
	optionId: string,
	updates: Partial<Pick<PropertyOption, "label" | "color">>,
): PropertyDefinition {
	return defineProperty({
		...definition,
		options: definition.options?.map((option) =>
			option.id === optionId ? { ...option, ...updates } : option,
		),
	})
}

export function removePropertyOption(
	definition: PropertyDefinition,
	optionId: string,
): PropertyDefinition {
	return defineProperty({
		...definition,
		options: definition.options?.filter((option) => option.id !== optionId),
		defaultOptionId:
			definition.defaultOptionId === optionId ? undefined : definition.defaultOptionId,
	})
}

export function setDefaultPropertyOption(
	definition: PropertyDefinition,
	optionId: string | undefined,
): PropertyDefinition {
	return defineProperty({ ...definition, defaultOptionId: optionId })
}

export function changePropertyType(
	definition: PropertyDefinition,
	type: string,
): PropertyDefinition {
	const currentUsesOptions = getPropertyType(definition.type)?.baseType === "select"
	const nextUsesOptions = getPropertyType(type)?.baseType === "select"
	return defineProperty({
		...definition,
		type,
		options: nextUsesOptions ? (currentUsesOptions ? definition.options : []) : undefined,
		defaultOptionId: nextUsesOptions ? definition.defaultOptionId : undefined,
		optionSort: nextUsesOptions ? (definition.optionSort ?? "manual") : undefined,
	})
}

export function duplicatePropertyDefinition(
	definition: PropertyDefinition,
	schema: VaultSchema,
	options: PropertyFactoryOptions = {},
): PropertyDefinition {
	const createId = options.createId ?? (() => crypto.randomUUID())
	const name = createUniquePropertyName(definition.name, schema.properties)
	const optionIds = new Map<string, string>()
	const duplicatedOptions = definition.options?.map((option) => {
		const id = createId()
		optionIds.set(option.id, id)
		return { ...option, id }
	})
	return defineProperty({
		...definition,
		id: createId(),
		key: createPropertyKey(name, schema.properties),
		name,
		createdAt: (options.now ?? (() => new Date()))().toISOString(),
		options: duplicatedOptions,
		defaultOptionId: definition.defaultOptionId
			? optionIds.get(definition.defaultOptionId)
			: undefined,
		observed: undefined,
	})
}

export function getSortedPropertyOptions(definition: PropertyDefinition): PropertyOption[] {
	const options = definition.options?.map((option) => ({ ...option })) ?? []
	return definition.optionSort === "alphabetical"
		? options.sort((left, right) => left.label.localeCompare(right.label))
		: options
}

export function validateVaultSchema(schema: VaultSchema): VaultSchema {
	const parsed = vaultSchemaSchema.parse(schema) as VaultSchema
	const properties = parsed.properties.map(defineProperty)
	assertUniqueDefinitions(properties)
	return { version: 1, properties }
}

export function isPropertyDefinitionEditable(definition: PropertyDefinition): boolean {
	return Boolean(getPropertyType(definition.type))
}
