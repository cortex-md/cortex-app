import {
	getPropertyType,
	isResolvedPropertyActor,
	type PropertyColor,
	type PropertyDefinition,
	parsePropertyDate,
	resolvePropertyOption,
} from "@cortex/properties"

import type { SymbolName } from "@/components/ui/Symbol"
import { listVaultMembers } from "@/features/collab/collabAdapter"

export type PropertyRouteName =
	| "add"
	| "edit"
	| "value"
	| "select"
	| "tags"
	| "option"
	| "person"
	| "date"
	| "auto"

export const AUTOMATIC_TYPES = new Set([
	"created_time",
	"created_by",
	"last_edited_time",
	"last_edited_by",
	"id",
])

export interface CreatableType {
	type: string
	label: string
	icon: SymbolName
}

export const CREATABLE_TYPES: CreatableType[] = [
	{ type: "text", label: "Text", icon: { sf: "textformat", md: "notes" } },
	{ type: "number", label: "Number", icon: { sf: "number", md: "numbers" } },
	{
		type: "select",
		label: "Select",
		icon: { sf: "list.bullet.circle", md: "arrow_drop_down_circle" },
	},
	{ type: "person", label: "Person", icon: { sf: "person", md: "person" } },
	{ type: "date", label: "Date", icon: { sf: "calendar", md: "calendar_today" } },
	{ type: "checkbox", label: "Checkbox", icon: { sf: "checkmark.square", md: "check_box" } },
	{ type: "url", label: "URL", icon: { sf: "link", md: "link" } },
	{ type: "email", label: "Email", icon: { sf: "envelope", md: "mail" } },
	{ type: "phone", label: "Phone", icon: { sf: "phone", md: "call" } },
]

export const AUTOMATIC_CREATABLE: CreatableType[] = [
	{ type: "created_time", label: "Created time", icon: { sf: "clock", md: "schedule" } },
	{
		type: "created_by",
		label: "Created by",
		icon: { sf: "person.crop.circle", md: "account_circle" },
	},
	{
		type: "last_edited_time",
		label: "Last edited time",
		icon: { sf: "clock.arrow.circlepath", md: "history" },
	},
]

export const COLOR_OPTIONS: { color: PropertyColor; label: string }[] = [
	{ color: "gray", label: "Gray" },
	{ color: "pink", label: "Rose" },
	{ color: "blue", label: "Blue" },
	{ color: "purple", label: "Violet" },
	{ color: "green", label: "Green" },
	{ color: "amber", label: "Yellow" },
	{ color: "red", label: "Red" },
	{ color: "teal", label: "Teal" },
]

const TAGS_ICON: SymbolName = { sf: "tag", md: "sell" }
const LOCK_ICON: SymbolName = { sf: "lock", md: "lock" }

export function getTypeIcon(type: string): SymbolName {
	const known = [...CREATABLE_TYPES, ...AUTOMATIC_CREATABLE].find((item) => item.type === type)
	if (known) return known.icon
	if (AUTOMATIC_TYPES.has(type)) return LOCK_ICON
	const baseType = getPropertyType(type)?.baseType
	if (baseType === "tags") return TAGS_ICON
	return CREATABLE_TYPES.find((item) => item.type === baseType)?.icon ?? CREATABLE_TYPES[0].icon
}

export function getTypeLabel(type: string): string {
	return getPropertyType(type)?.displayName ?? type
}

export function getBaseType(definition: PropertyDefinition): string {
	return getPropertyType(definition.type)?.baseType ?? definition.type
}

export function routeForDefinition(definition: PropertyDefinition): PropertyRouteName | null {
	if (AUTOMATIC_TYPES.has(definition.type)) return "auto"
	switch (getBaseType(definition)) {
		case "select":
			return "select"
		case "tags":
			return "tags"
		case "person":
			return "person"
		case "date":
			return "date"
		case "checkbox":
			return null
		default:
			return "value"
	}
}

export function getPropertyTags(value: unknown): string[] {
	const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
	const seen = new Set<string>()
	const tags: string[] = []
	for (const item of values) {
		if (typeof item !== "string" && typeof item !== "number") continue
		const tag = String(item).trim().replace(/^#+/, "")
		const key = tag.toLocaleLowerCase()
		if (!tag || seen.has(key)) continue
		seen.add(key)
		tags.push(tag)
	}
	return tags
}

export function formatDate(value: unknown): string | null {
	const date = parsePropertyDate(value)
	if (date)
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
	if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
		const parsed = new Date(value)
		return `${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
	}
	return null
}

export function formatPropertyValue(definition: PropertyDefinition, value: unknown): string {
	if (value === undefined || value === null || value === "") return "Empty"
	if (Array.isArray(value) && value.length === 0) return "Empty"
	if (isResolvedPropertyActor(value)) return value.label
	const values = Array.isArray(value) ? value : [value]
	switch (getBaseType(definition)) {
		case "select":
			return values.map((item) => resolvePropertyOption(definition, item).label).join(", ")
		case "person": {
			const members = listVaultMembers()
			return values
				.map((item) => members.find((member) => member.id === item)?.name ?? String(item))
				.join(", ")
		}
		case "date":
			return formatDate(value) ?? String(value)
		case "checkbox":
			return value ? "Yes" : "No"
		default:
			return values.map(String).join(", ")
	}
}
