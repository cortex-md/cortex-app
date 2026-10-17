import {
	getVisiblePropertyDefinitions,
	type PropertyDefinition,
	TAGS_PROPERTY_DEFINITION,
} from "@cortex/properties"

import { AUTOMATIC_TYPES } from "@/features/properties/propertyPresentation"
import type { NoteProperties } from "@/features/properties/useNoteProperties"

type VisibilitySource = Pick<
	NoteProperties,
	"persistedMeta" | "resolvedMeta" | "revealedKeys" | "schema"
>

export function visiblePropertyDefinitions(properties: VisibilitySource): PropertyDefinition[] {
	const idsByKey = new Map(
		properties.schema.properties.map((definition) => [definition.key, definition.id]),
	)
	if (!idsByKey.has(TAGS_PROPERTY_DEFINITION.key)) {
		idsByKey.set(TAGS_PROPERTY_DEFINITION.key, TAGS_PROPERTY_DEFINITION.id)
	}
	const revealedIds = new Set(
		[...properties.revealedKeys].flatMap((key) => {
			const id = idsByKey.get(key)
			return id ? [id] : []
		}),
	)
	return getVisiblePropertyDefinitions({
		properties: properties.schema.properties,
		persistedMeta: properties.persistedMeta,
		resolvedMeta: properties.resolvedMeta,
		revealedDefinitionIds: revealedIds,
	}).filter((definition) => !AUTOMATIC_TYPES.has(definition.type))
}
