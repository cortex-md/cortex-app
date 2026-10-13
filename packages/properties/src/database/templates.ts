import { createPropertyDefinition, createPropertyOption, defineProperty } from "../definitions"
import type {
	PropertyDefinition,
	PropertyFactoryOptions,
	PropertyMap,
	PropertyOption,
	VaultSchema,
} from "../types"
import { createDatabaseView } from "./config"
import {
	DATABASE_CONFIG_VERSION,
	type DatabaseConfig,
	type DatabasePreset,
	type DatabaseView,
} from "./types"

export const DATABASE_PRESETS: readonly DatabasePreset[] = [
	{
		id: "empty",
		name: "Empty",
		hint: "",
		properties: [],
		views: [{ type: "table", name: "Table" }],
		samples: [],
	},
	{
		id: "projects",
		name: "Projects",
		hint: "status · owner · due",
		properties: [
			{
				key: "status",
				name: "Status",
				type: "select",
				options: [
					{ label: "Backlog", color: "gray" },
					{ label: "In progress", color: "pink" },
					{ label: "In review", color: "amber" },
					{ label: "Done", color: "green" },
				],
			},
			{ key: "owner", name: "Owner", type: "person" },
			{ key: "due", name: "Due", type: "date" },
		],
		views: [
			{
				type: "table",
				name: "Table",
				group: "status",
				columns: ["status", "owner", "due"],
				sort: [{ key: "due", dir: "asc" }],
			},
			{ type: "board", name: "Board", group: "status" },
			{ type: "calendar", name: "Calendar", date: "due" },
		],
		samples: [
			{
				title: "Website refresh",
				values: { status: "In progress" },
				body: "## Next steps\n\n- [ ] Audit current pages\n- [ ] Draft the new structure\n",
			},
			{ title: "Q4 planning", values: { status: "Backlog" } },
			{ title: "Onboarding guide", values: { status: "In review" } },
		],
	},
	{
		id: "meetings",
		name: "Meetings",
		hint: "date · attendees",
		properties: [
			{ key: "date", name: "Date", type: "date" },
			{ key: "attendees", name: "Attendees", type: "person", multiple: true },
			{
				key: "type",
				name: "Type",
				type: "select",
				options: [
					{ label: "Weekly", color: "blue" },
					{ label: "Review", color: "purple" },
					{ label: "Project", color: "teal" },
				],
			},
		],
		views: [
			{
				type: "table",
				name: "Table",
				columns: ["date", "attendees", "type"],
				sort: [{ key: "date", dir: "desc" }],
			},
			{ type: "calendar", name: "Calendar", date: "date" },
		],
		samples: [
			{ title: "Weekly sync", values: { type: "Weekly" }, body: "## Agenda\n\n- \n\n## Notes\n\n" },
			{ title: "Design review", values: { type: "Review" } },
			{ title: "Kickoff", values: { type: "Project" } },
		],
	},
	{
		id: "reading",
		name: "Reading list",
		hint: "author · rating",
		properties: [
			{ key: "author", name: "Author", type: "text" },
			{
				key: "status",
				name: "Status",
				type: "select",
				options: [
					{ label: "To read", color: "gray" },
					{ label: "Reading", color: "pink" },
					{ label: "Done", color: "green" },
				],
			},
			{ key: "rating", name: "Rating", type: "number" },
		],
		views: [
			{ type: "gallery", name: "Gallery" },
			{ type: "table", name: "Table", columns: ["author", "status", "rating"] },
		],
		samples: [
			{ title: "Book title", values: { author: "Author", status: "Reading" } },
			{ title: "Article title", values: { author: "Author", status: "To read" } },
			{ title: "Paper title", values: { author: "Author", status: "Done", rating: 4 } },
		],
	},
	{
		id: "contacts",
		name: "Contacts",
		hint: "company · stage",
		properties: [
			{ key: "company", name: "Company", type: "text" },
			{
				key: "stage",
				name: "Stage",
				type: "select",
				options: [
					{ label: "Lead", color: "gray" },
					{ label: "Talking", color: "amber" },
					{ label: "Customer", color: "green" },
				],
			},
			{ key: "follow-up", name: "Follow up", type: "date" },
		],
		views: [
			{ type: "board", name: "Board", group: "stage" },
			{ type: "table", name: "Table", columns: ["company", "stage", "follow-up"] },
		],
		samples: [
			{ title: "Person A", values: { company: "Company", stage: "Lead" } },
			{ title: "Person B", values: { company: "Company", stage: "Talking" } },
			{ title: "Person C", values: { company: "Company", stage: "Customer" } },
		],
	},
]

export interface DatabasePresetSampleNote {
	title: string
	meta: PropertyMap
	body: string
}

export interface BuiltDatabasePreset {
	schema: VaultSchema
	schemaChanged: boolean
	config: DatabaseConfig
	samples: DatabasePresetSampleNote[]
}

export function getDatabasePreset(id: string): DatabasePreset {
	return DATABASE_PRESETS.find((preset) => preset.id === id) ?? DATABASE_PRESETS[0]
}

function ensureOptions(
	definition: PropertyDefinition,
	labels: readonly { label: string; color: PropertyOption["color"] }[],
	factory: PropertyFactoryOptions,
): PropertyDefinition {
	const options = [...(definition.options ?? [])]
	let changed = false
	for (const spec of labels) {
		const exists = options.some(
			(option) => option.label.toLocaleLowerCase() === spec.label.toLocaleLowerCase(),
		)
		if (exists) continue
		options.push(createPropertyOption(spec.label, options, factory, spec.color))
		changed = true
	}
	return changed ? defineProperty({ ...definition, options }) : definition
}

function remapView(view: Omit<DatabaseView, "id">, keys: ReadonlyMap<string, string>) {
	const key = (value: string) => keys.get(value) ?? value
	const next: Omit<DatabaseView, "id"> = { ...view }
	if (view.group) next.group = key(view.group)
	if (view.date) next.date = key(view.date)
	if (view.cover) next.cover = key(view.cover)
	if (view.columns) next.columns = view.columns.map(key)
	if (view.sort) next.sort = view.sort.map((sort) => ({ ...sort, key: key(sort.key) }))
	if (view.filters)
		next.filters = view.filters.map((filter) => ({ ...filter, key: key(filter.key) }))
	return next
}

export function buildDatabaseFromPreset(
	schema: VaultSchema,
	preset: DatabasePreset,
	factory: PropertyFactoryOptions = {},
): BuiltDatabasePreset {
	const properties = [...schema.properties]
	const keys = new Map<string, string>()
	let schemaChanged = false
	for (const spec of preset.properties) {
		const index = properties.findIndex(
			(definition) => definition.key.toLocaleLowerCase() === spec.key.toLocaleLowerCase(),
		)
		if (index >= 0) {
			const existing = properties[index]
			keys.set(spec.key, existing.key)
			if (spec.options && existing.type === "select") {
				const updated = ensureOptions(existing, spec.options, factory)
				if (updated !== existing) {
					properties[index] = updated
					schemaChanged = true
				}
			}
			continue
		}
		const created = createPropertyDefinition(
			{ name: spec.name, type: spec.type, key: spec.key, properties },
			factory,
		)
		const withOptions = spec.options ? ensureOptions(created, spec.options, factory) : created
		properties.push(
			spec.multiple ? defineProperty({ ...withOptions, multiple: true }) : withOptions,
		)
		keys.set(spec.key, created.key)
		schemaChanged = true
	}
	const byKey = new Map(properties.map((definition) => [definition.key, definition]))
	const views: DatabaseView[] = []
	for (const view of preset.views) {
		const remapped = remapView(view, keys)
		const { type, ...rest } = remapped
		views.push(createDatabaseView(type, views, rest))
	}
	const samples = preset.samples.map((sample) => {
		const meta: PropertyMap = {}
		for (const [specKey, value] of Object.entries(sample.values)) {
			const key = keys.get(specKey) ?? specKey
			const definition = byKey.get(key)
			if (definition?.type === "select" && typeof value === "string") {
				const option = definition.options?.find(
					(item) => item.label.toLocaleLowerCase() === value.toLocaleLowerCase(),
				)
				if (option) meta[key] = definition.multiple ? [option.id] : option.id
				continue
			}
			meta[key] = value
		}
		return { title: sample.title, meta, body: sample.body ?? "" }
	})
	const rowTemplates = (preset.rowTemplates ?? []).map((template, index) => ({
		id: `template-${index + 1}`,
		name: template.name,
		...(template.properties
			? {
					properties: Object.fromEntries(
						Object.entries(template.properties).map(([key, value]) => [
							keys.get(key) ?? key,
							value,
						]),
					),
				}
			: {}),
		...(template.body ? { body: template.body } : {}),
	}))
	return {
		schema: schemaChanged ? { version: 1, properties } : schema,
		schemaChanged,
		config: {
			version: DATABASE_CONFIG_VERSION,
			views,
			...(rowTemplates.length > 0 ? { templates: rowTemplates } : {}),
		},
		samples,
	}
}

export interface DatabasePresetExportInput {
	id: string
	name: string
	hint: string
	config: DatabaseConfig
	schema: VaultSchema
	rows: ReadonlyArray<{ title: string; meta: PropertyMap; body: string }>
	includeSamples: boolean
	sampleLimit?: number
}

function collectViewKeys(view: DatabaseView): string[] {
	return [
		view.group,
		view.date,
		view.cover,
		...(view.columns ?? []),
		...(view.sort ?? []).map((sort) => sort.key),
		...(view.filters ?? []).map((filter) => filter.key),
	].filter((key): key is string => Boolean(key) && !key?.startsWith("$"))
}

function toSampleValue(
	value: unknown,
	definition: PropertyDefinition | undefined,
): string | number | boolean | null {
	if (definition?.type === "select") {
		const ids = Array.isArray(value) ? value : [value]
		const label = definition.options?.find((option) => option.id === ids[0])?.label
		return label ?? null
	}
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value
	}
	return null
}

export function createDatabasePresetFromConfig(input: DatabasePresetExportInput): DatabasePreset {
	const byKey = new Map(input.schema.properties.map((definition) => [definition.key, definition]))
	const samples = input.includeSamples ? input.rows.slice(0, input.sampleLimit ?? 3) : []
	const keys = new Set<string>()
	for (const view of input.config.views) for (const key of collectViewKeys(view)) keys.add(key)
	for (const template of input.config.templates ?? []) {
		for (const key of Object.keys(template.properties ?? {})) keys.add(key)
	}
	for (const row of samples) for (const key of Object.keys(row.meta)) keys.add(key)
	const properties = [...keys].flatMap((key) => {
		const definition = byKey.get(key)
		if (!definition) return []
		return [
			{
				key: definition.key,
				name: definition.name,
				type: definition.type,
				...(definition.multiple ? { multiple: true } : {}),
				...(definition.options?.length
					? {
							options: definition.options.map((option) => ({
								label: option.label,
								color: option.color,
							})),
						}
					: {}),
			},
		]
	})
	return {
		id: input.id,
		name: input.name,
		hint: input.hint,
		properties,
		views: input.config.views.map(({ id: _id, order: _order, ...view }) => view),
		samples: samples.map((row) => ({
			title: row.title,
			values: Object.fromEntries(
				Object.entries(row.meta).flatMap(([key, value]) => {
					const sample = toSampleValue(value, byKey.get(key))
					return sample === null ? [] : [[key, sample]]
				}),
			),
			...(row.body.trim() ? { body: row.body } : {}),
		})),
		...(input.config.templates?.length
			? {
					rowTemplates: input.config.templates.map(({ id: _id, ...template }) => template),
				}
			: {}),
	}
}

export function parseDatabasePreset(value: unknown): DatabasePreset | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null
	const raw = value as Partial<DatabasePreset>
	if (typeof raw.name !== "string" || !Array.isArray(raw.properties) || !Array.isArray(raw.views)) {
		return null
	}
	const viewTypes: readonly string[] = ["table", "board", "calendar", "gallery"]
	return {
		id: typeof raw.id === "string" ? raw.id : raw.name,
		name: raw.name,
		hint: typeof raw.hint === "string" ? raw.hint : "",
		properties: raw.properties.filter(
			(spec) =>
				spec &&
				typeof spec.key === "string" &&
				typeof spec.name === "string" &&
				typeof spec.type === "string",
		),
		views: raw.views.filter((view) => view && viewTypes.includes(view.type)),
		samples: Array.isArray(raw.samples)
			? raw.samples.filter((sample) => sample && typeof sample.title === "string")
			: [],
		...(Array.isArray(raw.rowTemplates)
			? {
					rowTemplates: raw.rowTemplates.filter(
						(template) => template && typeof template.name === "string",
					),
				}
			: {}),
	}
}
