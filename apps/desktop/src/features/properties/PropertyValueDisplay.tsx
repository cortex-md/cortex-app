import {
	getPropertyType,
	isEmptyPropertyValue,
	isResolvedPropertyActor,
	type PropertyDefinition,
	parsePropertyDate,
	type ResolvedAuthorConfig,
	type ResolvedPropertyActor,
	resolvePropertyOption,
} from "@cortex/properties"
import { Avatar, AvatarFallback } from "@cortex/ui"
import { CheckSquare2Icon } from "lucide-react"
import { PropertyOptionValue } from "./PropertyOptionValue"
import { TagChipList } from "./TagChipList"
import { getTagsFromPropertyValue } from "./tagsValue"

const propertyDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
})

const propertyDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
})

function getInitials(label: string): string {
	return label
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toLocaleUpperCase())
		.join("")
}

function formatPropertyDate(value: unknown): string {
	const date = parsePropertyDate(value)
	return date ? propertyDateFormatter.format(date) : String(value ?? "")
}

function ActorValue({ actor }: { actor: ResolvedPropertyActor }) {
	const detail =
		actor.kind === "person"
			? actor.current
				? "You"
				: actor.email
			: actor.kind === "device" && actor.current
				? "This device"
				: undefined
	return (
		<span className="note-property-person-value">
			<Avatar size="sm">
				<AvatarFallback>{getInitials(actor.label)}</AvatarFallback>
			</Avatar>
			<span className="note-property-identity-copy">
				<span>{actor.label}</span>
				{detail && <small>{detail}</small>}
			</span>
		</span>
	)
}

interface PropertyValueDisplayProps {
	definition: PropertyDefinition
	value: unknown
	authorConfig: ResolvedAuthorConfig
	onRemoveTag?(tag: string): void
}

export function PropertyValueDisplay({
	definition,
	value,
	authorConfig,
	onRemoveTag,
}: PropertyValueDisplayProps) {
	const propertyType = getPropertyType(definition.type)
	if (!propertyType) {
		return (
			<span className="note-property-unavailable">
				{String(value)}
				<small>Type unavailable</small>
			</span>
		)
	}
	if (propertyType.baseType === "tags") {
		return <TagChipList tags={getTagsFromPropertyValue(value)} onRemoveTag={onRemoveTag} />
	}
	if (isEmptyPropertyValue(value)) return <span className="note-property-empty">Empty</span>
	if (propertyType.baseType === "select") {
		return <PropertyOptionValue option={resolvePropertyOption(definition, value)} />
	}
	if (isResolvedPropertyActor(value)) return <ActorValue actor={value} />
	const personBased = propertyType.baseType === "person" || definition.key === "author"
	if (personBased && authorConfig.variant === "person" && typeof value === "string") {
		const person = authorConfig.options.find((option) => option.id === value)
		if (person) {
			return (
				<span className="note-property-person-value">
					<Avatar size="sm">
						<AvatarFallback>{getInitials(person.label)}</AvatarFallback>
					</Avatar>
					{person.label}
				</span>
			)
		}
	}
	if (propertyType.baseType === "checkbox") {
		return value === true ? (
			<span className="note-property-checkbox-value">
				<CheckSquare2Icon className="note-property-checkbox-icon" />
				Checked
			</span>
		) : (
			<span className="note-property-empty">Unchecked</span>
		)
	}
	if (propertyType.baseType === "date") {
		if (definition.type === "created_time" || definition.type === "last_edited_time") {
			const date = new Date(String(value))
			return (
				<span>
					{Number.isNaN(date.getTime()) ? String(value) : propertyDateTimeFormatter.format(date)}
				</span>
			)
		}
		return <span>{formatPropertyDate(value)}</span>
	}
	return <span className="note-property-text-value">{String(value)}</span>
}
