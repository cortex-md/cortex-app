import {
	Avatar,
	AvatarFallback,
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui"
import { CheckIcon, XIcon } from "lucide-react"
import type { PropertyValueEditorProps } from "../types"
import { TextValueEditor } from "./TextValueEditor"

function getInitials(label: string): string {
	return label
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toLocaleUpperCase())
		.join("")
}

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
	const selected = authorConfig.options.find((person) => person.id === value)
	return (
		<Command className="note-property-command">
			{selected && (
				<div className="note-property-selected-person">
					<Avatar size="sm">
						<AvatarFallback>{getInitials(selected.label)}</AvatarFallback>
					</Avatar>
					<span>{selected.label}</span>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label={`Remove ${selected.label}`}
						onClick={() => void onRemoveValue()}
					>
						<XIcon />
					</Button>
				</div>
			)}
			<CommandInput autoFocus placeholder="Search for people..." />
			<CommandList>
				<CommandGroup heading="Select a person">
					{authorConfig.options.map((person) => (
						<CommandItem
							key={person.id}
							value={`${person.label} ${person.email ?? ""}`}
							onSelect={() => {
								void onSetValue(person.id).then(onClose)
							}}
						>
							<Avatar size="sm">
								<AvatarFallback>{getInitials(person.label)}</AvatarFallback>
							</Avatar>
							<span>
								{person.label}
								{person.id === authorConfig.currentUserId && (
									<span className="note-property-you"> (You)</span>
								)}
							</span>
							{person.id === value && <CheckIcon className="ml-auto" />}
						</CommandItem>
					))}
				</CommandGroup>
				<CommandEmpty>No people found</CommandEmpty>
			</CommandList>
		</Command>
	)
}
