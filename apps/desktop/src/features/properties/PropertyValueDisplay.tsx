import {
	getPropertyType,
	getPropertyValueHref,
	getPropertyValueList,
	isEmptyPropertyValue,
	isResolvedPropertyActor,
	type PropertyDefinition,
	parsePropertyDate,
	type ResolvedAuthorConfig,
	type ResolvedPropertyActor,
	resolvePropertyOption,
} from "@cortex/properties"
import { CheckSquare2Icon } from "lucide-react"
import { formatDateTime, formatShortDate } from "@/utils/format"
import { UserAvatar } from "../sync/UserAvatar"
import { PropertyOptionValue } from "./PropertyOptionValue"
import { TagChipList } from "./TagChipList"
import { getTagsFromPropertyValue } from "./tagsValue"

function formatPropertyDate(value: unknown): string {
	const date = parsePropertyDate(value)
	return date ? formatShortDate(date) : String(value ?? "")
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
			<UserAvatar
				name={actor.label}
				avatarUrl={actor.kind === "person" ? actor.avatarUrl : null}
				size="sm"
				className="note-property-avatar"
			/>
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
		return (
			<span className="note-property-value-list">
				{getPropertyValueList(value).map((item) => (
					<PropertyOptionValue
						key={String(item)}
						option={resolvePropertyOption(definition, item)}
					/>
				))}
			</span>
		)
	}
	if (isResolvedPropertyActor(value)) return <ActorValue actor={value} />
	const personBased = propertyType.baseType === "person" || definition.key === "author"
	if (personBased && authorConfig.variant === "person") {
		const people = getPropertyValueList(value).flatMap((item) => {
			const person = authorConfig.options.find((option) => option.id === item)
			return person ? [person] : []
		})
		if (people.length > 0) {
			return (
				<span className="note-property-value-list">
					{people.map((person) => (
						<span key={person.id} className="note-property-person-value">
							<UserAvatar
								name={person.label}
								avatarUrl={person.avatarUrl}
								size="sm"
								className="note-property-avatar"
							/>
							{person.label}
						</span>
					))}
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
			return <span>{formatDateTime(String(value))}</span>
		}
		return <span>{formatPropertyDate(value)}</span>
	}
	if (getPropertyValueHref(definition.type, value)) {
		return <span className="note-property-link-value">{String(value)}</span>
	}
	return <span className="note-property-text-value">{String(value)}</span>
}
