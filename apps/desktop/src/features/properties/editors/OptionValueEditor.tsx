import { useVaultStore } from "@cortex/core"
import {
	allowsMultipleValues,
	createPropertyOption,
	getPropertyValueList,
	getPropertyValueUsage,
	getSortedPropertyOptions,
	isEmptyPropertyValue,
	type PropertyDefinition,
	resolvePropertyOption,
	togglePropertyValue,
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
import { useEffect, useState } from "react"
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
	const multiple = allowsMultipleValues(definition)
	const selectedIds = new Set(getPropertyValueList(value).map(String))
	const selected = [...selectedIds].map((id) => resolvePropertyOption(definition, id))
	const usage = usePropertyUsage(definition.key)
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
		await chooseOption(option.id)
		setQuery("")
	}

	async function chooseOption(optionId: string) {
		const next = togglePropertyValue(definition, value, optionId)
		if (isEmptyPropertyValue(next)) await onRemoveValue()
		else await onSetValue(next)
		if (!multiple) onClose()
	}

	return (
		<Command shouldFilter={false} className="note-property-command">
			{selected.length > 0 && (
				<div className="note-property-selected-value">
					{selected.map((option) => (
						<PropertyOptionValue
							key={option.id}
							option={option}
							onRemove={() => void chooseOption(option.id)}
						/>
					))}
				</div>
			)}
			<CommandInput
				autoFocus
				placeholder={options.length > 0 ? "Search or create an option" : "Create an option"}
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				<CommandGroup heading={filteredOptions.length > 0 ? "Options" : undefined}>
					{filteredOptions.map((option) => (
						<CommandItem
							key={option.id}
							value={option.label}
							onSelect={() => void chooseOption(option.id)}
						>
							<PropertyOptionValue option={option} />
							{selectedIds.has(option.id) && <CheckIcon className="ml-auto" />}
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
			<p className="note-property-popover-hint">
				{options.length} {options.length === 1 ? "option" : "options"}
				{usage !== null &&
					` · shared by ${usage} ${usage === 1 ? "note" : "notes"} using ${definition.name}`}
			</p>
		</Command>
	)
}

function usePropertyUsage(key: string): number | null {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const [usage, setUsage] = useState<{ key: string; notes: number } | null>(null)
	useEffect(() => {
		if (!vaultPath) return
		let cancelled = false
		void getPropertyValueUsage(vaultPath, key).then((result) => {
			if (!cancelled) setUsage({ key, notes: result.notes })
		})
		return () => {
			cancelled = true
		}
	}, [key, vaultPath])
	return usage?.key === key ? usage.notes : null
}
