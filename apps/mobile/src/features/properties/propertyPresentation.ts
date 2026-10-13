import {
	getPropertyType,
	isResolvedPropertyActor,
	parsePropertyDate,
	type PropertyColor,
	type PropertyDefinition,
	resolvePropertyOption,
} from "@cortex/properties"

import type { StatusTone } from "@/components/ui/StatusPill"
import { listVaultMembers } from "@/features/collab/collabAdapter"
import type { MobileColors } from "@/theme/colors"

export type PropertyStep =
	| "values"
	| "add"
	| "settings"
	| "select"
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
}

export const CREATABLE_TYPES: CreatableType[] = [
	{ type: "text", label: "Text" },
	{ type: "number", label: "Number" },
	{ type: "select", label: "Select" },
	{ type: "person", label: "Person" },
	{ type: "date", label: "Date" },
	{ type: "checkbox", label: "Checkbox" },
	{ type: "url", label: "URL" },
	{ type: "email", label: "Email" },
	{ type: "phone", label: "Phone" },
]

export const AUTOMATIC_CREATABLE: CreatableType[] = [
	{ type: "created_time", label: "Created time" },
	{ type: "created_by", label: "Created by" },
	{ type: "last_edited_time", label: "Last edited time" },
]

export const COLOR_SWATCHES: { color: PropertyColor; label: string }[] = [
	{ color: "gray", label: "Gray" },
	{ color: "pink", label: "Rose" },
	{ color: "blue", label: "Blue" },
	{ color: "purple", label: "Violet" },
	{ color: "green", label: "Green" },
	{ color: "amber", label: "Yellow" },
	{ color: "red", label: "Red" },
	{ color: "teal", label: "Teal" },
]

export function swatchColor(color: PropertyColor, colors: MobileColors): string {
	switch (color) {
		case "pink":
			return colors.tintFill
		case "blue":
			return colors.headingBlue
		case "purple":
			return colors.headingViolet
		case "green":
			return colors.swatchGreen
		case "amber":
			return colors.swatchYellow
		case "red":
			return colors.swatchRed
		case "teal":
			return colors.success
		default:
			return colors.tertiaryLabel
	}
}

export function optionTone(color: PropertyColor): StatusTone {
	switch (color) {
		case "green":
		case "teal":
			return "done"
		case "amber":
		case "red":
			return "review"
		case "blue":
		case "pink":
		case "purple":
			return "progress"
		default:
			return "backlog"
	}
}

export function getTypeLabel(type: string): string {
	return getPropertyType(type)?.displayName ?? type
}

export function getBaseType(definition: PropertyDefinition): string {
	return getPropertyType(definition.type)?.baseType ?? definition.type
}

export function stepForDefinition(definition: PropertyDefinition | null): PropertyStep {
	if (!definition) return "values"
	if (AUTOMATIC_TYPES.has(definition.type)) return "auto"
	switch (getBaseType(definition)) {
		case "select":
			return "select"
		case "person":
			return "person"
		case "date":
			return "date"
		default:
			return "values"
	}
}

export function formatDate(value: unknown): string | null {
	const date = parsePropertyDate(value)
	if (date) return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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
