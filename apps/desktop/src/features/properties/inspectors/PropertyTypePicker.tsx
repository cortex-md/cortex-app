import { changePropertyType, getPropertyTypes, type PropertyDefinition } from "@cortex/properties"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui"
import { CheckIcon } from "lucide-react"
import { PropertyTypeIcon } from "../PropertyTypeIcon"
import { PanelHeader } from "./PanelHeader"

interface PropertyTypePickerProps {
	definition: PropertyDefinition
	onBack(): void
	onUpdateDefinition(definition: PropertyDefinition): Promise<void>
}

export function PropertyTypePicker({
	definition,
	onBack,
	onUpdateDefinition,
}: PropertyTypePickerProps) {
	const types =
		definition.key === "author"
			? getPropertyTypes().filter((type) => type.type === "text")
			: getPropertyTypes()
	return (
		<div className="note-property-picker-panel">
			<PanelHeader title="Type" onBack={onBack} />
			<Command className="note-property-command">
				<CommandInput autoFocus placeholder="Search property types..." />
				<CommandList>
					<CommandGroup heading="Property type">
						{types.map((type) => (
							<CommandItem
								key={type.type}
								value={`${type.displayName} ${type.type}`}
								onSelect={() => {
									void onUpdateDefinition(changePropertyType(definition, type.type)).then(onBack)
								}}
							>
								<PropertyTypeIcon icon={type.icon} />
								<span>{type.displayName}</span>
								{type.type === definition.type && <CheckIcon className="ml-auto" />}
							</CommandItem>
						))}
					</CommandGroup>
					<CommandEmpty>No property types found</CommandEmpty>
				</CommandList>
			</Command>
		</div>
	)
}
