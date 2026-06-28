import {
	createPropertyOption,
	getPropertyType,
	getSortedPropertyOptions,
	type PropertyDefinition,
	type VaultSchema,
} from "@cortex/properties"
import { Button, Input, Separator } from "@cortex/ui"
import { ArrowDownAZIcon, ChevronRightIcon, CopyIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useRef, useState } from "react"
import { PropertyOptionValue } from "../PropertyOptionValue"
import { PropertyTypeIcon } from "../PropertyTypeIcon"
import type { PropertyInspectorPanel } from "../types"
import { PanelHeader } from "./PanelHeader"

interface PropertySettingsProps {
	definition: PropertyDefinition
	schema: VaultSchema
	onPush(panel: PropertyInspectorPanel): void
	onUpdateDefinition(definition: PropertyDefinition): Promise<void>
	onDeleteDefinition(): Promise<void>
	onDuplicateDefinition(): Promise<void>
}

export function PropertySettings({
	definition,
	schema,
	onPush,
	onUpdateDefinition,
	onDeleteDefinition,
	onDuplicateDefinition,
}: PropertySettingsProps) {
	const propertyType = getPropertyType(definition.type)
	const optionBased = propertyType?.baseType === "select"
	const nameInputRef = useRef<HTMLInputElement>(null)
	const [nameError, setNameError] = useState<string | null>(null)
	const options = getSortedPropertyOptions(definition)
	const commitName = async () => {
		const trimmedName = (nameInputRef.current?.value ?? definition.name).trim()
		if (!trimmedName) {
			setNameError("Property name is required")
			return
		}
		const duplicate = schema.properties.some(
			(property) =>
				property.id !== definition.id &&
				property.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
		)
		if (duplicate) {
			setNameError("Property names must be unique")
			return
		}
		if (trimmedName !== definition.name) {
			await onUpdateDefinition({ ...definition, name: trimmedName })
		}
		setNameError(null)
	}

	return (
		<div className="note-property-settings">
			<PanelHeader title="Property inspector" />
			<div className="note-property-name-field">
				<Input
					key={`${definition.id}:${definition.name}`}
					ref={nameInputRef}
					autoFocus
					defaultValue={definition.name}
					aria-label="Property name"
					aria-invalid={Boolean(nameError)}
					onBlur={() => void commitName()}
					onKeyDown={(event) => {
						if (event.key === "Enter") void commitName()
					}}
				/>
			</div>
			{nameError && <output className="note-properties-error">{nameError}</output>}
			<div className="note-property-config-list">
				<Button variant="ghost" onClick={() => onPush({ kind: "types" })}>
					<PropertyTypeIcon icon={propertyType?.icon ?? "circle-help"} />
					<span>Type</span>
					<small>{propertyType?.displayName ?? definition.type}</small>
					<ChevronRightIcon />
				</Button>
				{optionBased && (
					<Button variant="ghost" onClick={() => onPush({ kind: "sort" })}>
						<ArrowDownAZIcon />
						<span>Sort</span>
						<small>{definition.optionSort === "alphabetical" ? "Alphabetical" : "Manual"}</small>
						<ChevronRightIcon />
					</Button>
				)}
			</div>
			{optionBased && (
				<>
					<Separator />
					<div className="note-property-options-header">
						<span>Options</span>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Add option"
							onClick={() => {
								const option = createPropertyOption("New option", definition.options)
								void onUpdateDefinition({
									...definition,
									options: [...(definition.options ?? []), option],
									optionSort: definition.optionSort ?? "manual",
								}).then(() => onPush({ kind: "option", optionId: option.id }))
							}}
						>
							<PlusIcon />
						</Button>
					</div>
					<ul className="note-property-option-list">
						{options.map((option) => (
							<li className="note-property-option-row" key={option.id}>
								<Button
									variant="ghost"
									className="note-property-option-main"
									onClick={() => onPush({ kind: "option", optionId: option.id })}
								>
									<PropertyOptionValue option={option} />
									<ChevronRightIcon />
								</Button>
							</li>
						))}
					</ul>
				</>
			)}
			<Separator />
			<div className="note-property-settings-actions">
				<Button variant="ghost" onClick={() => void onDuplicateDefinition()}>
					<CopyIcon />
					Duplicate property
				</Button>
				<Button
					variant="ghost"
					className="note-property-delete-action"
					onClick={() => void onDeleteDefinition()}
				>
					<Trash2Icon />
					Delete property
				</Button>
			</div>
		</div>
	)
}
