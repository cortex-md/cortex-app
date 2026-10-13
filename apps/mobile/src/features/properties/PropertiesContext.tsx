import type { PropertyDefinition } from "@cortex/properties"
import { useLocalSearchParams } from "expo-router"
import { createContext, type ReactNode, use } from "react"

import { type NoteProperties, useNoteProperties } from "@/features/properties/useNoteProperties"

const PropertiesContext = createContext<NoteProperties | null>(null)

export function PropertiesProvider({
	children,
	filePath,
}: {
	children: ReactNode
	filePath: string | null
}) {
	const properties = useNoteProperties(filePath)
	return <PropertiesContext value={properties}>{children}</PropertiesContext>
}

export function useProperties(): NoteProperties {
	const properties = use(PropertiesContext)
	if (!properties) throw new Error("useProperties must be used inside PropertiesProvider")
	return properties
}

function firstParam(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

export function usePropertyRouteParams(): { key?: string; optionId?: string } {
	const params = useLocalSearchParams<{
		key?: string | string[]
		optionId?: string | string[]
	}>()
	return { key: firstParam(params.key), optionId: firstParam(params.optionId) }
}

export function useRouteDefinition(): {
	definition: PropertyDefinition | null
	optionId?: string
	properties: NoteProperties
} {
	const properties = useProperties()
	const { key, optionId } = usePropertyRouteParams()
	return { definition: properties.findDefinition(key), optionId, properties }
}
