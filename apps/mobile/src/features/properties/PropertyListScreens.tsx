import { isResolvedPropertyActor, type PropertyDefinition } from "@cortex/properties"
import { Stack } from "expo-router"
import { Platform } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { dismissSheet } from "@/features/navigation/routes"
import { useProperties } from "@/features/properties/PropertiesContext"
import {
	AUTOMATIC_TYPES,
	formatDate,
	formatPropertyValue,
	getTypeIcon,
	routeForDefinition,
} from "@/features/properties/propertyPresentation"
import { pushPropertyRoute } from "@/features/properties/propertyRoutes"
import type { NoteProperties } from "@/features/properties/useNoteProperties"
import { visiblePropertyDefinitions } from "@/features/properties/visibleProperties"

const IS_IOS = Platform.OS === "ios"

function PropertyRow({
	definition,
	properties,
}: {
	definition: PropertyDefinition
	properties: NoteProperties
}) {
	const value = properties.resolvedMeta[definition.key]
	const route = routeForDefinition(definition)
	if (!route) {
		return (
			<FormToggle
				icon={getTypeIcon(definition.type)}
				onValueChange={(next) => void properties.setValue(definition, next)}
				title={definition.name}
				value={value === true}
			/>
		)
	}
	return (
		<FormRow
			chevron
			icon={getTypeIcon(definition.type)}
			onPress={() => pushPropertyRoute(route, { key: definition.key })}
			title={definition.name}
			value={formatPropertyValue(definition, value)}
		/>
	)
}

export function PropertyValuesScreen() {
	const properties = useProperties()
	const definitions = visiblePropertyDefinitions(properties)
	const hasAutomatic = properties.schema.properties.some((definition) =>
		AUTOMATIC_TYPES.has(definition.type),
	)

	return (
		<>
			<Stack.Screen
				options={{
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ sf: "xmark", md: "close" }}
									onPress={dismissSheet}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button onPress={dismissSheet} variant="done">
						Done
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<NativeForm>
				{definitions.length > 0 ? (
					<FormSection>
						{definitions.map((definition) => (
							<PropertyRow definition={definition} key={definition.key} properties={properties} />
						))}
					</FormSection>
				) : null}
				<FormSection>
					<FormRow
						icon={{ sf: "plus", md: "add" }}
						onPress={() => pushPropertyRoute("add")}
						tint
						title="Add property"
					/>
					{hasAutomatic ? (
						<FormRow
							chevron
							icon={{ sf: "lock", md: "lock" }}
							onPress={() => pushPropertyRoute("auto")}
							title="Automatic properties"
						/>
					) : null}
				</FormSection>
			</NativeForm>
		</>
	)
}

export function PropertyAutoScreen() {
	const properties = useProperties()
	const automatic = properties.schema.properties.filter((definition) =>
		AUTOMATIC_TYPES.has(definition.type),
	)

	return (
		<NativeForm>
			<FormSection footer="Set by Cortex. Read-only.">
				{automatic.map((definition) => {
					const value = properties.resolvedMeta[definition.key]
					const label = isResolvedPropertyActor(value)
						? value.label
						: (formatDate(value) ?? formatPropertyValue(definition, value))
					return (
						<FormRow
							icon={getTypeIcon(definition.type)}
							key={definition.key}
							title={definition.name}
							value={label}
						/>
					)
				})}
			</FormSection>
		</NativeForm>
	)
}
