import {
	getSortedPropertyOptions,
	type PropertyDefinition,
	resolvePropertyOption,
} from "@cortex/properties"
import {
	DATABASE_TITLE_KEY,
	type DatabaseFilter,
	type DatabaseFilterOperator,
	type DatabaseView,
	getDatabaseFilterOperators,
	getPropertyBaseType,
} from "@cortex/properties/database"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	NativeSelect,
	NativeSelectOption,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cortex/ui"
import { PlusIcon, XIcon } from "lucide-react"

const OPERATOR_LABELS: Record<DatabaseFilterOperator, string> = {
	is: "is",
	is_not: "is not",
	contains: "contains",
	not_contains: "does not contain",
	is_empty: "is empty",
	is_not_empty: "is not empty",
	gt: "is after",
	gte: "is on or after",
	lt: "is before",
	lte: "is on or before",
}

const NUMBER_OPERATOR_LABELS: Partial<Record<DatabaseFilterOperator, string>> = {
	gt: ">",
	gte: "≥",
	lt: "<",
	lte: "≤",
}

const TITLE_DEFINITION: PropertyDefinition = {
	id: DATABASE_TITLE_KEY,
	key: DATABASE_TITLE_KEY,
	name: "Name",
	type: "text",
	createdAt: "1970-01-01T00:00:00.000Z",
}

function operatorLabel(definition: PropertyDefinition, op: DatabaseFilterOperator): string {
	return getPropertyBaseType(definition) === "number"
		? (NUMBER_OPERATOR_LABELS[op] ?? OPERATOR_LABELS[op])
		: OPERATOR_LABELS[op]
}

function describeValue(definition: PropertyDefinition, value: unknown): string {
	if (value === undefined || value === null || value === "") return ""
	if (value === "$me") return "me"
	if (value === "$today") return "today"
	const baseType = getPropertyBaseType(definition)
	if (baseType === "select") return resolvePropertyOption(definition, value).label
	if (baseType === "checkbox") return value === true ? "checked" : "unchecked"
	return String(value)
}

function needsValue(op: DatabaseFilterOperator): boolean {
	return op !== "is_empty" && op !== "is_not_empty"
}

interface FilterValueInputProps {
	definition: PropertyDefinition
	value: unknown
	onChange: (value: unknown) => void
}

function SelectFilterValue({ definition, value, onChange }: FilterValueInputProps) {
	return (
		<NativeSelect
			size="sm"
			aria-label="Value"
			value={typeof value === "string" ? value : ""}
			onChange={(event) => onChange(event.target.value || undefined)}
		>
			<NativeSelectOption value="">Choose…</NativeSelectOption>
			{getSortedPropertyOptions(definition).map((option) => (
				<NativeSelectOption key={option.id} value={option.id}>
					{option.label}
				</NativeSelectOption>
			))}
		</NativeSelect>
	)
}

function CheckboxFilterValue({ value, onChange }: FilterValueInputProps) {
	return (
		<NativeSelect
			size="sm"
			aria-label="Value"
			value={value === true ? "true" : "false"}
			onChange={(event) => onChange(event.target.value === "true")}
		>
			<NativeSelectOption value="true">Checked</NativeSelectOption>
			<NativeSelectOption value="false">Unchecked</NativeSelectOption>
		</NativeSelect>
	)
}

function TokenFilterValue({
	value,
	onChange,
	token,
	tokenLabel,
	type,
	placeholder,
}: FilterValueInputProps & {
	token: string
	tokenLabel: string
	type: string
	placeholder?: string
}) {
	return (
		<div className="db-filter-value-row">
			<Input
				size="sm"
				type={type}
				aria-label="Value"
				placeholder={placeholder}
				value={typeof value === "string" && value !== token ? value : ""}
				onChange={(event) => onChange(event.target.value || undefined)}
			/>
			<Button variant="secondary" size="xs" onClick={() => onChange(token)}>
				{tokenLabel}
			</Button>
		</div>
	)
}

function TextFilterValue({
	value,
	onChange,
	numeric,
}: FilterValueInputProps & { numeric: boolean }) {
	return (
		<Input
			size="sm"
			type={numeric ? "number" : "text"}
			aria-label="Value"
			value={value === undefined || value === null ? "" : String(value)}
			onChange={(event) => {
				const raw = event.target.value
				if (!raw) onChange(undefined)
				else onChange(numeric ? Number(raw) : raw)
			}}
		/>
	)
}

function FilterValueInput(props: FilterValueInputProps) {
	const baseType = getPropertyBaseType(props.definition)
	if (baseType === "select") return <SelectFilterValue {...props} />
	if (baseType === "checkbox") return <CheckboxFilterValue {...props} />
	if (baseType === "person") {
		return (
			<TokenFilterValue
				{...props}
				token="$me"
				tokenLabel="Me"
				type="text"
				placeholder="Name or id"
			/>
		)
	}
	if (baseType === "date") {
		return <TokenFilterValue {...props} token="$today" tokenLabel="Today" type="date" />
	}
	return <TextFilterValue {...props} numeric={baseType === "number"} />
}

interface FilterChipProps {
	filter: DatabaseFilter
	definition: PropertyDefinition
	onChange: (filter: DatabaseFilter) => void
	onRemove: () => void
}

function FilterChip({ filter, definition, onChange, onRemove }: FilterChipProps) {
	const value = needsValue(filter.op) ? describeValue(definition, filter.value) : ""
	return (
		<span className="db-chip">
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="ghost" className="db-chip-main">
						{definition.name} <b>{operatorLabel(definition, filter.op)}</b> {value}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="db-filter-editor">
					<span className="db-filter-editor-label">{definition.name}</span>
					<NativeSelect
						size="sm"
						aria-label="Condition"
						value={filter.op}
						onChange={(event) =>
							onChange({ ...filter, op: event.target.value as DatabaseFilterOperator })
						}
					>
						{getDatabaseFilterOperators(definition).map((op) => (
							<NativeSelectOption key={op} value={op}>
								{operatorLabel(definition, op)}
							</NativeSelectOption>
						))}
					</NativeSelect>
					{needsValue(filter.op) && (
						<FilterValueInput
							definition={definition}
							value={filter.value}
							onChange={(next) => onChange({ ...filter, value: next })}
						/>
					)}
				</PopoverContent>
			</Popover>
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label={`Remove ${definition.name} filter`}
				onClick={onRemove}
			>
				<XIcon />
			</Button>
		</span>
	)
}

function keyFilters(filters: readonly DatabaseFilter[]) {
	const seen = new Map<string, number>()
	return filters.map((filter, position) => {
		const occurrence = seen.get(filter.key) ?? 0
		seen.set(filter.key, occurrence + 1)
		return { id: `${filter.key}#${occurrence}`, filter, position }
	})
}

interface DatabaseFilterBarProps {
	view: DatabaseView
	properties: PropertyDefinition[]
	onUpdateView: (update: (view: DatabaseView) => DatabaseView) => void
}

export function DatabaseFilterBar({ view, properties, onUpdateView }: DatabaseFilterBarProps) {
	const filters = view.filters ?? []
	const candidates = [TITLE_DEFINITION, ...properties]
	const byKey = new Map(candidates.map((definition) => [definition.key, definition]))
	const keyedFilters = keyFilters(filters)
	const setFilters = (next: DatabaseFilter[]) =>
		onUpdateView((target) => ({ ...target, filters: next.length ? next : undefined }))
	return (
		<div className="db-filters">
			{keyedFilters.map(({ id, filter, position }) => {
				const definition = byKey.get(filter.key)
				if (!definition) return null
				return (
					<FilterChip
						key={id}
						filter={filter}
						definition={definition}
						onChange={(next) =>
							setFilters(filters.map((item, i) => (i === position ? next : item)))
						}
						onRemove={() => setFilters(filters.filter((_, i) => i !== position))}
					/>
				)
			})}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="db-filter-add">
						<PlusIcon />
						Add filter
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="db-menu">
					{candidates.map((definition) => (
						<DropdownMenuItem
							key={definition.id}
							onSelect={() =>
								setFilters([
									...filters,
									{ key: definition.key, op: getDatabaseFilterOperators(definition)[0] },
								])
							}
						>
							{definition.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
