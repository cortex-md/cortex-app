import { PROPERTY_COLORS, type PropertyDefinition, updatePropertyOption } from "@cortex/properties"
import { Button } from "@cortex/ui"
import { CheckIcon } from "lucide-react"
import { propertyColorLabels } from "./constants"
import { PanelHeader } from "./PanelHeader"

interface PropertyColorPickerProps {
	definition: PropertyDefinition
	optionId: string
	onBack(): void
	onUpdateDefinition(definition: PropertyDefinition): Promise<void>
}

export function PropertyColorPicker({
	definition,
	optionId,
	onBack,
	onUpdateDefinition,
}: PropertyColorPickerProps) {
	const option = definition.options?.find((candidate) => candidate.id === optionId)
	if (!option) return null
	return (
		<div className="note-property-picker-panel">
			<PanelHeader title="Color" onBack={onBack} />
			<div className="note-property-color-list">
				{PROPERTY_COLORS.map((color) => (
					<Button
						key={color}
						variant="ghost"
						onClick={() => {
							void onUpdateDefinition(updatePropertyOption(definition, option.id, { color })).then(
								onBack,
							)
						}}
					>
						<span className="note-property-color-swatch" data-color={color} />
						{propertyColorLabels[color]}
						{option.color === color && <CheckIcon className="ml-auto" />}
					</Button>
				))}
			</div>
		</div>
	)
}
