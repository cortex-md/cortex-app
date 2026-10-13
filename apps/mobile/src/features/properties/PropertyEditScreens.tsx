import {
	changePropertyType,
	getSortedPropertyOptions,
	removePropertyOption,
	supportsMultipleValues,
	updatePropertyOption,
} from "@cortex/properties"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { useRouteDefinition } from "@/features/properties/PropertiesContext"
import { PropertyPicker, PropertyTextField } from "@/features/properties/PropertyControls"
import {
	COLOR_OPTIONS,
	CREATABLE_TYPES,
	getBaseType,
	getTypeIcon,
	getTypeLabel,
} from "@/features/properties/propertyPresentation"
import { popPropertyRoute, pushPropertyRoute } from "@/features/properties/propertyRoutes"

const REMOVE_ICON = { sf: "trash", md: "delete" } as const

function usageLabel(count: number): string {
	return `Used in ${count} ${count === 1 ? "note" : "notes"}.`
}

export function PropertyEditScreen() {
	const { definition, properties } = useRouteDefinition()
	if (!definition) return <NativeForm>{null}</NativeForm>
	const usage = properties.usageFor(definition.key).notes
	const typeOptions = CREATABLE_TYPES.map((item) => ({ label: item.label, value: item.type }))
	if (!typeOptions.some((option) => option.value === definition.type)) {
		typeOptions.push({ label: getTypeLabel(definition.type), value: definition.type })
	}
	const options = getBaseType(definition) === "select" ? getSortedPropertyOptions(definition) : []

	return (
		<NativeForm>
			<FormSection footer={`${usageLabel(usage)} Name and type apply to every note.`}>
				<PropertyTextField
					initialValue={definition.name}
					key={definition.id}
					label="Name"
					onCommit={(value) => {
						const name = value.trim()
						if (name && name !== definition.name) {
							void properties.saveDefinition({ ...definition, name })
						}
					}}
					placeholder="Name"
				/>
				<PropertyPicker
					icon={getTypeIcon(definition.type)}
					onChange={(type) => {
						if (type !== definition.type) {
							void properties.saveDefinition(changePropertyType(definition, type))
						}
					}}
					options={typeOptions}
					title="Type"
					value={definition.type}
				/>
				{supportsMultipleValues(definition.type) ? (
					<FormToggle
						onValueChange={(multiple) =>
							void properties.saveDefinition({ ...definition, multiple })
						}
						title="Allow multiple values"
						value={definition.multiple === true}
					/>
				) : null}
				<FormToggle
					onValueChange={(hideWhenEmpty) =>
						void properties.saveDefinition({ ...definition, hideWhenEmpty })
					}
					title="Hide when empty"
					value={definition.hideWhenEmpty === true}
				/>
			</FormSection>
			{options.length > 0 ? (
				<FormSection title="Options">
					{options.map((option) => (
						<FormRow
							chevron
							key={option.id}
							onPress={() =>
								pushPropertyRoute("option", { key: definition.key, optionId: option.id })
							}
							title={option.label}
						/>
					))}
				</FormSection>
			) : null}
			<FormSection>
				<FormRow
					destructive
					icon={REMOVE_ICON}
					onPress={() => {
						void properties.removeValue(definition).then((removed) => {
							if (removed) popPropertyRoute()
						})
					}}
					title="Remove from this note"
				/>
			</FormSection>
		</NativeForm>
	)
}

export function PropertyOptionScreen() {
	const { definition, optionId, properties } = useRouteDefinition()
	const option = definition?.options?.find((candidate) => candidate.id === optionId)
	if (!definition || !option) return <NativeForm>{null}</NativeForm>
	const used = properties.usageFor(definition.key).values[option.id] ?? 0

	return (
		<NativeForm>
			<FormSection footer={usageLabel(used)}>
				<PropertyTextField
					initialValue={option.label}
					key={option.id}
					label="Name"
					onCommit={(value) => {
						const label = value.trim()
						if (label && label !== option.label) {
							void properties.saveDefinition(updatePropertyOption(definition, option.id, { label }))
						}
					}}
					placeholder="Name"
				/>
				<PropertyPicker
					icon={{ sf: "paintpalette", md: "palette" }}
					onChange={(color) => {
						const next = COLOR_OPTIONS.find((item) => item.color === color)
						if (next) {
							void properties.saveDefinition(
								updatePropertyOption(definition, option.id, { color: next.color }),
							)
						}
					}}
					options={COLOR_OPTIONS.map((item) => ({ label: item.label, value: item.color }))}
					title="Colour"
					value={option.color}
				/>
			</FormSection>
			<FormSection>
				<FormRow
					destructive
					icon={REMOVE_ICON}
					onPress={() => {
						void properties
							.saveDefinition(removePropertyOption(definition, option.id))
							.then((saved) => {
								if (saved) popPropertyRoute()
							})
					}}
					title="Delete option"
				/>
			</FormSection>
		</NativeForm>
	)
}
