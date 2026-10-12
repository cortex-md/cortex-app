import type { PropertyDefinition, PropertyMap } from "./types"
import { isEmptyPropertyValue } from "./values"

export const TAGS_PROPERTY_DEFINITION: PropertyDefinition = {
	id: "00000000-0000-4000-8000-000000000001",
	key: "tags",
	name: "tags",
	type: "tags",
	createdAt: "1970-01-01T00:00:00.000Z",
}

const persistedOnlySystemTypes = new Set(["id", "created_by", "last_edited_time", "last_edited_by"])

export interface PropertyVisibilityInput {
	properties: readonly PropertyDefinition[]
	persistedMeta: PropertyMap
	resolvedMeta: PropertyMap
	revealedDefinitionIds: ReadonlySet<string>
}

function isVisiblePropertyDefinition(
	definition: PropertyDefinition,
	{ persistedMeta, resolvedMeta, revealedDefinitionIds }: PropertyVisibilityInput,
): boolean {
	if (definition.key === "database") return false
	if (revealedDefinitionIds.has(definition.id)) return true
	const hasPersistedValue = Object.hasOwn(persistedMeta, definition.key)
	const persistedValue = persistedMeta[definition.key]
	if (definition.type === "created_time") {
		return !isEmptyPropertyValue(resolvedMeta[definition.key])
	}
	if (persistedOnlySystemTypes.has(definition.type)) {
		return hasPersistedValue && !isEmptyPropertyValue(persistedValue)
	}
	if (definition.defaultOptionId && isEmptyPropertyValue(persistedValue)) return false
	if (definition.hideWhenEmpty && isEmptyPropertyValue(persistedValue)) return false
	return hasPersistedValue
}

export function getVisiblePropertyDefinitions(
	input: PropertyVisibilityInput,
): PropertyDefinition[] {
	const visibleDefinitions = input.properties.filter((definition) =>
		isVisiblePropertyDefinition(definition, input),
	)
	const schemaTagsDefinition = input.properties.find((definition) => definition.key === "tags")
	if (schemaTagsDefinition) {
		const visibleTagsDefinition = visibleDefinitions.find(
			(definition) => definition.id === schemaTagsDefinition.id,
		)
		return visibleTagsDefinition
			? [
					visibleTagsDefinition,
					...visibleDefinitions.filter((definition) => definition !== visibleTagsDefinition),
				]
			: visibleDefinitions
	}
	const showVirtualTags =
		Object.hasOwn(input.persistedMeta, "tags") ||
		input.revealedDefinitionIds.has(TAGS_PROPERTY_DEFINITION.id)
	return showVirtualTags ? [TAGS_PROPERTY_DEFINITION, ...visibleDefinitions] : visibleDefinitions
}

export function getHiddenPropertyDefinitions(
	properties: readonly PropertyDefinition[],
	visibleDefinitions: readonly PropertyDefinition[],
): PropertyDefinition[] {
	const visibleIds = new Set(visibleDefinitions.map((definition) => definition.id))
	return properties.filter((definition) => !visibleIds.has(definition.id))
}
