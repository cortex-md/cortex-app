import {
	getPropertyType,
	getPropertyValueList,
	isEmptyPropertyValue,
	type PropertyDefinition,
	type PropertyOption,
	parsePropertyDate,
	type ResolvedAuthorConfig,
	resolvePropertyOption,
} from "@cortex/properties"
import { StatusBadge } from "@cortex/ui"
import { CheckIcon } from "lucide-react"
import { getInitials } from "@/utils/format"
import { PropertyValueDisplay } from "../properties/PropertyValueDisplay"

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" })
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const LONG_DATE = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	month: "short",
	day: "numeric",
})
const DAY_MS = 86_400_000

export type DueTone = "over" | "soon" | ""

export interface RelativeDate {
	label: string
	full: string
	tone: DueTone
}

export function formatRelativeDate(value: unknown, today: string): RelativeDate | null {
	const date = parsePropertyDate(typeof value === "string" ? value.slice(0, 10) : value)
	const base = parsePropertyDate(today)
	if (!date || !base) return null
	const days = Math.round((date.getTime() - base.getTime()) / DAY_MS)
	const full = LONG_DATE.format(date)
	if (days === 0) return { label: "Today", full, tone: "soon" }
	if (days === 1) return { label: "Tomorrow", full, tone: "soon" }
	if (days === -1) return { label: "Yesterday", full, tone: "over" }
	if (days < 0) return { label: `${-days} days late`, full, tone: "over" }
	if (days < 7) return { label: WEEKDAY.format(date), full, tone: days <= 2 ? "soon" : "" }
	return { label: SHORT_DATE.format(date), full, tone: "" }
}

function hashTone(value: string): number {
	let hash = 0
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0
	}
	return (Math.abs(hash) % 4) + 1
}

export function DatabaseAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
	return (
		<span className="db-av" data-tone={hashTone(name)} title={name} aria-hidden="true">
			{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : getInitials(name)}
		</span>
	)
}

export function DatabasePill({ option }: { option: PropertyOption }) {
	return <StatusBadge color={option.color}>{option.label}</StatusBadge>
}

export function resolvePersonLabel(
	value: unknown,
	authorConfig: ResolvedAuthorConfig,
): { name: string; avatarUrl: string | null } {
	const id = String(value)
	if (authorConfig.variant === "person") {
		const person = authorConfig.options.find((option) => option.id === id)
		if (person) return { name: person.label, avatarUrl: person.avatarUrl ?? null }
	}
	return { name: id, avatarUrl: null }
}

interface DatabaseValueProps {
	definition: PropertyDefinition
	value: unknown
	authorConfig: ResolvedAuthorConfig
	today: string
	compact?: boolean
	avatarOnly?: boolean
}

export function DatabaseValue({
	definition,
	value,
	authorConfig,
	today,
	compact = false,
	avatarOnly = false,
}: DatabaseValueProps) {
	const type = getPropertyType(definition.type)
	const baseType = type?.baseType
	if (isEmptyPropertyValue(value)) {
		return compact ? null : <span className="db-value-empty">Empty</span>
	}
	if (baseType === "select") {
		return (
			<span className="db-value-list">
				{getPropertyValueList(value).map((item) => (
					<DatabasePill key={String(item)} option={resolvePropertyOption(definition, item)} />
				))}
			</span>
		)
	}
	if (baseType === "person") {
		return (
			<span className="db-value-list">
				{getPropertyValueList(value).map((item) => {
					const person = resolvePersonLabel(item, authorConfig)
					return (
						<span key={String(item)} className="db-who">
							<DatabaseAvatar name={person.name} avatarUrl={person.avatarUrl} />
							{!avatarOnly && <span>{person.name.split(/\s+/u)[0]}</span>}
						</span>
					)
				})}
			</span>
		)
	}
	if (baseType === "date" && !type?.readOnly) {
		const relative = formatRelativeDate(value, today)
		if (relative) {
			return (
				<span className="db-when" data-tone={relative.tone || undefined} title={relative.full}>
					{relative.label}
				</span>
			)
		}
	}
	if (baseType === "checkbox") {
		return value === true ? (
			<span className="db-check" role="img" aria-label="Checked">
				<CheckIcon />
			</span>
		) : (
			<span className="db-value-empty">No</span>
		)
	}
	if (baseType === "tags") {
		return (
			<span className="db-value-list">
				{getPropertyValueList(value).map((tag) => (
					<span key={String(tag)} className="db-tag">
						#{String(tag)}
					</span>
				))}
			</span>
		)
	}
	if (baseType === "number") return <span className="db-number">{String(value)}</span>
	return <PropertyValueDisplay definition={definition} value={value} authorConfig={authorConfig} />
}
