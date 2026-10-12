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
	return {
		schema: schemaChanged ? { version: 1, properties } : schema,
		schemaChanged,
		config: { version: DATABASE_CONFIG_VERSION, views },
		samples,
	}
}
