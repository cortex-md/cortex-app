import {
	allowsMultipleValues,
	getPropertyValueList,
	isEmptyPropertyValue,
	togglePropertyValue,
} from "@cortex/properties"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui"
import { CheckIcon, XIcon } from "lucide-react"
import { UserAvatar } from "../../sync/UserAvatar"
import type { PropertyValueEditorProps } from "../types"
import { TextValueEditor } from "./TextValueEditor"

export function PersonValueEditor({
	definition,
	value,
	authorConfig,
	onSetValue,
	onRemoveValue,
	onClose,
}: Omit<PropertyValueEditorProps, "filePath" | "onUpdateDefinition">) {
	if (authorConfig.variant === "text") {
		return (
			<TextValueEditor
				definition={definition}
				value={value}
				onSetValue={onSetValue}
				onRemoveValue={onRemoveValue}
				onClose={onClose}
			/>
		)
	}
	const multiple = allowsMultipleValues(definition)
	const selectedIds = new Set(getPropertyValueList(value).map(String))
	const selected = authorConfig.options.filter((person) => selectedIds.has(person.id))
	const choosePerson = async (personId: string) => {
		const next = togglePropertyValue(definition, value, personId)
		if (isEmptyPropertyValue(next)) await onRemoveValue()
		else await onSetValue(next)
		if (!multiple) onClose()
	}
	return (
		<Command className="note-property-command">
			{selected.map((person) => (
				<div key={person.id} className="note-property-selected-person">
					<UserAvatar name={person.label} avatarUrl={person.avatarUrl} size="sm" />
					<span>{person.label}</span>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label={`Remove ${person.label}`}
						onClick={() => void choosePerson(person.id)}
					>
						<XIcon />
					</Button>
				</div>
			))}
			<CommandInput autoFocus placeholder="Search for people..." />
			<CommandList>
				<CommandGroup heading="Select a person">
					{authorConfig.options.map((person) => (
						<CommandItem
							key={person.id}
							value={`${person.label} ${person.email ?? ""}`}
							onSelect={() => void choosePerson(person.id)}
						>
							<UserAvatar name={person.label} avatarUrl={person.avatarUrl} size="sm" />
							<span>
								{person.label}
								{person.id === authorConfig.currentUserId && (
									<span className="note-property-you"> (You)</span>
								)}
							</span>
							{selectedIds.has(person.id) && <CheckIcon className="ml-auto" />}
						</CommandItem>
					))}
				</CommandGroup>
				<CommandEmpty>No people found</CommandEmpty>
			</CommandList>
		</Command>
	)
}
