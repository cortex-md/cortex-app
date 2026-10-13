import type { PropertyDefinition } from "@cortex/properties"

import type { PropertyStep } from "@/features/properties/propertyPresentation"
import type { NoteProperties } from "@/features/properties/useNoteProperties"

export interface PropertyRoute {
	step: PropertyStep
	key?: string
	optionId?: string
	query?: string
}

export interface PropertyStepProps {
	definition: PropertyDefinition | null
	pop: () => void
	properties: NoteProperties
	push: (route: PropertyRoute) => void
	route: PropertyRoute
}
