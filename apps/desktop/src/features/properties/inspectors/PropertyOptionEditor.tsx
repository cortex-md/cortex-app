import {
	getPropertyType,
	type PropertyDefinition,
	removePropertyOption,
	setDefaultPropertyOption,
	updatePropertyOption,
} from "@cortex/properties"
import { Button, Input, Separator, Switch } from "@cortex/ui"
import { ChevronRightIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import type { PropertyInspectorPanel } from "../types"
import { propertyColorLabels } from "./constants"
import { PanelHeader } from "./PanelHeader"

interface PropertyOptionEditorProps {
	definition: PropertyDefinition
	optionId: string
	onBack(): void
	onPush(panel: PropertyInspectorPanel): void
	onUpdateDefinition(definition: PropertyDefinition): Promise<void>
}

export function PropertyOptionEditor({
	definition,
	optionId,
	onBack,
	onPush,
	onUpdateDefinition,
}: PropertyOptionEditorProps) {
	const option = definition.options?.find((candidate) => candidate.id === optionId)
	const [label, setLabel] = useState(option?.label ?? "")
	if (!option) {
		return (
			<div className="note-property-picker-panel">
				<PanelHeader title="Option unavailable" onBack={onBack} />
			</div>
		)
	}
	return (
		<div className="note-property-option-editor">
			<PanelHeader title="Edit option" onBack={onBack} />
			<Input
				autoFocus
				value={label}
				aria-label="Option label"
				onChange={(event) => setLabel(event.target.value)}
				onBlur={() => {
					const nextLabel = label.trim()
					if (nextLabel && nextLabel !== option.label) {
						void onUpdateDefinition(
							updatePropertyOption(definition, option.id, { label: nextLabel }),
						)
					}
				}}
			/>
			<Button variant="ghost" onClick={() => onPush({ kind: "color", optionId })}>
				<span className="note-property-color-dot" data-color={option.color} />
				<span>Color</span>
				<small>{propertyColorLabels[option.color]}</small>
				<ChevronRightIcon />
			</Button>
			{getPropertyType(definition.type)?.baseType === "select" && (
				<div className="note-property-switch-row">
					<span>Default option</span>
					<Switch
						size="sm"
						checked={definition.defaultOptionId === option.id}
						onCheckedChange={(checked) =>
							void onUpdateDefinition(
								setDefaultPropertyOption(definition, checked ? option.id : undefined),
							)
						}
					/>
				</div>
			)}
			<Separator />
			<Button
				variant="ghost"
				className="note-property-delete-action"
				onClick={() => {
					void onUpdateDefinition(removePropertyOption(definition, option.id)).then(onBack)
				}}
			>
				<Trash2Icon />
				Delete option
			</Button>
		</div>
	)
}
