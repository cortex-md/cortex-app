import { createPropertyDefinition, type PropertyDefinition } from "@cortex/properties"
import { useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { useProperties } from "@/features/properties/PropertiesContext"
import { PropertyTextField } from "@/features/properties/PropertyControls"
import {
	AUTOMATIC_CREATABLE,
	AUTOMATIC_TYPES,
	CREATABLE_TYPES,
	type CreatableType,
	getTypeIcon,
	getTypeLabel,
	routeForDefinition,
} from "@/features/properties/propertyPresentation"
import { popPropertyRoute, replacePropertyRoute } from "@/features/properties/propertyRoutes"

export function PropertyAddScreen() {
	const properties = useProperties()
	const [query, setQuery] = useState("")
	const normalized = query.trim().toLocaleLowerCase()
	const onNote = new Set([...Object.keys(properties.persistedMeta), ...properties.revealedKeys])
	const suggestions = properties.schema.properties.filter(
		(definition) =>
			!onNote.has(definition.key) &&
			!AUTOMATIC_TYPES.has(definition.type) &&
			definition.key !== "database" &&
			(!normalized || definition.name.toLocaleLowerCase().includes(normalized)),
	)
	const createName = query.trim() || "Property"

	function openDefinition(definition: PropertyDefinition) {
		const route = routeForDefinition(definition)
		if (!route || route === "auto") popPropertyRoute()
		else replacePropertyRoute(route, { key: definition.key })
	}

	function addExisting(definition: PropertyDefinition) {
		properties.reveal(definition.key)
		openDefinition(definition)
	}

	async function createProperty(item: CreatableType) {
		const definition = createPropertyDefinition({
			name: createName,
			type: item.type,
			properties: properties.schema.properties,
		})
		if (!(await properties.saveDefinition(definition))) return
		properties.reveal(definition.key)
		openDefinition(definition)
	}

	function typeRows(items: CreatableType[]) {
		return items.map((item) => (
			<FormRow
				icon={item.icon}
				key={item.type}
				onPress={() => void createProperty(item)}
				title={item.label}
			/>
		))
	}

	return (
		<NativeForm>
			<FormSection>
				<PropertyTextField autoFocus onChangeText={setQuery} placeholder="Property name" />
			</FormSection>
			{suggestions.length > 0 ? (
				<FormSection title="In this vault">
					{suggestions.map((definition) => {
						const usage = properties.usageFor(definition.key).notes
						return (
							<FormRow
								icon={getTypeIcon(definition.type)}
								key={definition.key}
								onPress={() => addExisting(definition)}
								subtitle={`${getTypeLabel(definition.type)} · ${usage} ${usage === 1 ? "note" : "notes"}`}
								title={definition.name}
							/>
						)
					})}
				</FormSection>
			) : null}
			<FormSection title={normalized ? `Create "${createName}" as` : "Type"}>
				{typeRows(CREATABLE_TYPES)}
			</FormSection>
			<FormSection title="Automatic">{typeRows(AUTOMATIC_CREATABLE)}</FormSection>
		</NativeForm>
	)
}
