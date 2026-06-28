import { formatCalloutLabel, normalizeCalloutName } from "./model"

export interface CalloutTypeDefinition {
	type: string
	aliases: string[]
	label: string
	color?: string
	backgroundColor?: string
	fallbackType?: string
}

export interface CalloutTypeRegistration {
	type: string
	aliases?: string[]
	label?: string
	color?: string
	backgroundColor?: string
}

interface CalloutRegistrationEntry {
	id: number
	namespace: string
	registration: CalloutTypeRegistration
}

const builtinCalloutTypes: CalloutTypeDefinition[] = [
	{ type: "note", aliases: [], label: "Note" },
	{ type: "abstract", aliases: ["summary", "tldr"], label: "Abstract" },
	{ type: "info", aliases: [], label: "Info" },
	{ type: "todo", aliases: [], label: "Todo" },
	{ type: "tip", aliases: ["hint", "important"], label: "Tip" },
	{ type: "success", aliases: ["check", "done"], label: "Success" },
	{ type: "question", aliases: ["help", "faq"], label: "Question" },
	{ type: "warning", aliases: ["caution", "attention"], label: "Warning" },
	{ type: "failure", aliases: ["fail", "missing"], label: "Failure" },
	{ type: "danger", aliases: ["error"], label: "Danger" },
	{ type: "bug", aliases: [], label: "Bug" },
	{ type: "example", aliases: [], label: "Example" },
	{ type: "quote", aliases: ["cite"], label: "Quote" },
]

const registrations: CalloutRegistrationEntry[] = []
const listeners = new Set<() => void>()
let nextRegistrationId = 0
let registryVersion = 0

function buildEffectiveCalloutTypes(): CalloutTypeDefinition[] {
	const definitions = builtinCalloutTypes.map((definition) => ({
		...definition,
		aliases: [...definition.aliases],
	}))
	const definitionsByType = new Map(definitions.map((definition) => [definition.type, definition]))
	const definitionsByAlias = new Map<string, CalloutTypeDefinition>()
	const definitionIndexesByType = new Map(
		definitions.map((definition, index) => [definition.type, index]),
	)
	for (const definition of definitions) {
		for (const alias of definition.aliases) definitionsByAlias.set(alias, definition)
	}

	for (const entry of registrations) {
		const registrationType = normalizeCalloutName(entry.registration.type)
		if (!registrationType) continue

		const aliasOwner =
			definitionsByType.get(registrationType) ?? definitionsByAlias.get(registrationType)
		const canonicalType = aliasOwner?.type ?? registrationType
		const existing = definitionsByType.get(canonicalType)
		const registrationAliases = (entry.registration.aliases ?? []).flatMap((alias) => {
			const normalizedAlias = normalizeCalloutName(alias)
			return normalizedAlias && normalizedAlias !== canonicalType ? [normalizedAlias] : []
		})
		const aliases = Array.from(new Set([...(existing?.aliases ?? []), ...registrationAliases]))
		const definition: CalloutTypeDefinition = {
			type: canonicalType,
			aliases,
			label:
				entry.registration.label?.trim() || existing?.label || formatCalloutLabel(canonicalType),
			color: entry.registration.color ?? existing?.color,
			backgroundColor: entry.registration.backgroundColor ?? existing?.backgroundColor,
		}

		if (existing) {
			const index = definitionIndexesByType.get(existing.type) ?? -1
			definitions[index] = definition
		} else {
			definitionIndexesByType.set(definition.type, definitions.length)
			definitions.push(definition)
		}
		definitionsByType.set(canonicalType, definition)
		for (const alias of definition.aliases) definitionsByAlias.set(alias, definition)
	}

	return definitions
}

function notifyCalloutRegistryChanged(): void {
	registryVersion++
	for (const listener of listeners) {
		try {
			listener()
		} catch (error) {
			console.error("[Callout registry listener failed]", {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}
}

export function getCalloutTypes(): CalloutTypeDefinition[] {
	return buildEffectiveCalloutTypes()
}

export function resolveCalloutType(type: string): CalloutTypeDefinition {
	const normalizedType = normalizeCalloutName(type)
	const definitions = getCalloutTypes()
	const definition = definitions.find(
		(candidate) => candidate.type === normalizedType || candidate.aliases.includes(normalizedType),
	)
	if (definition) return definition

	const note = definitions.find((candidate) => candidate.type === "note") ?? builtinCalloutTypes[0]
	return {
		...note,
		type: normalizedType || "note",
		aliases: [],
		label: normalizedType ? formatCalloutLabel(normalizedType) : note.label,
		fallbackType: "note",
	}
}

function validateCalloutColor(value: string | undefined, field: string): void {
	const normalizedValue = value?.trim()
	if (
		normalizedValue !== undefined &&
		!/^#[0-9a-fA-F]{3,8}$|^var\(--[a-zA-Z0-9_-]+\)$|^[a-zA-Z]+$|^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([0-9a-zA-Z.% ,/+_-]+\)$/.test(
			normalizedValue,
		)
	) {
		throw new Error(`Invalid callout ${field}`)
	}
}

export function registerCalloutType(
	registration: CalloutTypeRegistration,
	namespace = "core",
): () => void {
	const type = normalizeCalloutName(registration.type)
	if (!type) throw new Error("Callout type is required")
	const aliases = (registration.aliases ?? []).map(normalizeCalloutName)
	if (aliases.some((alias) => !alias)) throw new Error("Callout aliases must not be empty")
	validateCalloutColor(registration.color, "color")
	validateCalloutColor(registration.backgroundColor, "background color")
	const entry: CalloutRegistrationEntry = {
		id: nextRegistrationId++,
		namespace: namespace.trim() || "core",
		registration: {
			...registration,
			type,
			aliases,
			label: registration.label?.trim(),
			color: registration.color?.trim(),
			backgroundColor: registration.backgroundColor?.trim(),
		},
	}
	registrations.push(entry)
	notifyCalloutRegistryChanged()

	return () => {
		const index = registrations.findIndex((candidate) => candidate.id === entry.id)
		if (index < 0) return
		registrations.splice(index, 1)
		notifyCalloutRegistryChanged()
	}
}

export function subscribeCalloutTypes(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function getCalloutRegistryVersion(): number {
	return registryVersion
}

export function getCalloutStyleVariables(definition: CalloutTypeDefinition): {
	color: string
	backgroundColor: string
} {
	const fallbackType = definition.fallbackType ?? definition.type
	return {
		color:
			definition.color ??
			`var(--callout-${fallbackType}-color, var(--callout-note-color, var(--accent)))`,
		backgroundColor:
			definition.backgroundColor ??
			`var(--callout-${fallbackType}-bg, var(--callout-note-bg, var(--accent-subtle)))`,
	}
}
