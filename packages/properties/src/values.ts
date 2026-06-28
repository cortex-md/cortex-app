import type {
	PrimitivePropertyType,
	PropertyDefinition,
	PropertyOption,
	ResolvedPropertyActor,
} from "./types"

export function isEmptyPropertyValue(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	)
}

export function resolvePropertyOption(
	definition: PropertyDefinition,
	value: unknown,
): PropertyOption {
	return (
		definition.options?.find((option) => option.id === value) ?? {
			id: String(value ?? ""),
			label: "Unknown",
			color: "gray",
		}
	)
}

export function isResolvedPropertyActor(value: unknown): value is ResolvedPropertyActor {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		typeof (value as ResolvedPropertyActor).kind === "string"
	)
}

export function parsePropertyDate(value: unknown): Date | undefined {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
	const [year, month, day] = value.split("-").map(Number)
	const date = new Date(year, month - 1, day)
	if (
		Number.isNaN(date.getTime()) ||
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return undefined
	}
	return date
}

export function serializePropertyDate(value: Date): string {
	const year = value.getFullYear()
	const month = String(value.getMonth() + 1).padStart(2, "0")
	const day = String(value.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

export function parsePropertyInput(baseType: PrimitivePropertyType, value: string): unknown {
	if (value === "") return ""
	return baseType === "number" ? Number(value) : value
}
