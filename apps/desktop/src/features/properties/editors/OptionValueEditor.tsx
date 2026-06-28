import {
	createPropertyOption,
	getSortedPropertyOptions,
	isEmptyPropertyValue,
	type PropertyDefinition,
	resolvePropertyOption,
} from "@cortex/properties"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui"
import { CheckIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { PropertyOptionValue } from "../PropertyOptionValue"
import type { PropertyValueEditorProps } from "../types"

export function OptionValueEditor({
	definition,
	value,
	onSetValue,
	onRemoveValue,
	onUpdateDefinition,
	onClose,
}: Omit<PropertyValueEditorProps, "authorConfig" | "filePath">) {
	const [query, setQuery] = useState("")
	const options = getSortedPropertyOptions(definition)
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const filteredOptions = options.filter((option) =>
		option.label.toLocaleLowerCase().includes(normalizedQuery),
	)
	const selected = isEmptyPropertyValue(value)
		? undefined
		: resolvePropertyOption(definition, value)
	const exactMatch = options.some((option) => option.label.toLocaleLowerCase() === normalizedQuery)

	const createOption = async () => {
		const label = query.trim()
		if (!label || exactMatch) return
		const option = createPropertyOption(label, definition.options)
		const nextDefinition: PropertyDefinition = {
			...definition,
			options: [...(definition.options ?? []), option],
			optionSort: definition.optionSort ?? "manual",
		}
		await onUpdateDefinition(nextDefinition)
		await onSetValue(option.id)
		onClose()
	}

	return (
		<Command shouldFilter={false} className="note-property-command">
			{selected && (
				<div className="note-property-selected-value">
					<PropertyOptionValue option={selected} onRemove={() => void onRemoveValue()} />
				</div>
			)}
			<CommandInput
				autoFocus
				placeholder="Select an option or create one"
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				<CommandGroup heading="Select an option or create one">
					{filteredOptions.map((option) => (
						<CommandItem
							key={option.id}
							value={option.label}
							onSelect={() => {
								void onSetValue(option.id).then(onClose)
							}}
						>
							<PropertyOptionValue option={option} />
							{option.id === value && <CheckIcon className="ml-auto" />}
						</CommandItem>
					))}
					{query.trim() && !exactMatch && (
						<CommandItem value={`create ${query}`} onSelect={() => void createOption()}>
							<PlusIcon />
							Create “{query.trim()}”
						</CommandItem>
					)}
				</CommandGroup>
				<CommandEmpty>No options found</CommandEmpty>
			</CommandList>
		</Command>
	)
}
