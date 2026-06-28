import { selectProperty } from "./__tests__/fixtures/definitions"
import { createTestPropertiesRuntime } from "./__tests__/fixtures/runtime"
import {
	changePropertyType,
	createPropertyDefinition,
	createPropertyOption,
	defineProperty,
	duplicatePropertyDefinition,
	getSortedPropertyOptions,
	removePropertyOption,
	setDefaultPropertyOption,
	updatePropertyOption,
	validateVaultSchema,
} from "./definitions"
import { getPropertyType, registerPropertyType, resetCustomPropertyTypes } from "./registry"
import { getVaultSchema, updateVaultSchema } from "./schemaStore"
import type { VaultSchema } from "./types"
import {
	isEmptyPropertyValue,
	parsePropertyDate,
	parsePropertyInput,
	resolvePropertyOption,
	serializePropertyDate,
} from "./values"

describe("property definitions", () => {
	afterEach(() => resetCustomPropertyTypes())

	it("provides validation and codecs for every built-in type", () => {
		const examples: Array<[string, unknown, unknown]> = [
			["text", "value", 1],
			["number", 2, "2"],
			["select", "option-id", ""],
			["tags", ["aws", "certificado"], "aws"],
			["person", "user-id", 2],
			["date", "2026-06-13", "June 13"],
			["checkbox", true, "true"],
			["url", "https://cortex.dev", "cortex"],
			["email", "user@cortex.dev", "bad"],
			["phone", "+1 555 0100", "x"],
			["created_time", "2026-06-13T12:00:00.000Z", "today"],
			["created_by", "user-id", ""],
			["last_edited_time", "2026-06-13T12:00:00.000Z", "today"],
			["last_edited_by", "user-id", ""],
			["id", "note-id", ""],
		]
		for (const [type, valid, invalid] of examples) {
			const definition = getPropertyType(type)
			expect(definition?.validate(valid)).toEqual({ valid: true })
			expect(definition?.validate(invalid).valid).toBe(false)
			expect(definition?.deserialize(definition.serialize(valid))).toEqual(valid)
		}
		expect(getPropertyType("created_time")?.readOnly).toBe(true)
	})

	it("creates definitions and options through injected factories", () => {
		let id = 0
		const createId = () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`
		const definition = createPropertyDefinition(
			{ name: "Review stage", type: "select", properties: [selectProperty] },
			{ createId, now: () => new Date("2026-06-14T00:00:00.000Z") },
		)
		const option = createPropertyOption("Ready", [], { createId }, "teal")

		expect(definition).toMatchObject({
			key: "review-stage",
			name: "Review stage",
			type: "select",
			createdAt: "2026-06-14T00:00:00.000Z",
			options: [],
			optionSort: "manual",
		})
		expect(option).toMatchObject({ label: "Ready", color: "teal" })
	})

	it("updates, defaults, and removes options without changing stable IDs", () => {
		const optionId = selectProperty.options?.[0]?.id ?? ""
		const renamed = updatePropertyOption(selectProperty, optionId, {
			label: "Complete",
			color: "blue",
		})
		const defaulted = setDefaultPropertyOption(renamed, optionId)
		const removed = removePropertyOption(defaulted, optionId)

		expect(renamed.options?.[0]).toEqual({
			id: optionId,
			label: "Complete",
			color: "blue",
		})
		expect(defaulted.defaultOptionId).toBe(optionId)
		expect(removed.options).toEqual([])
		expect(removed.defaultOptionId).toBeUndefined()
	})

	it("preserves options while select remains option based", () => {
		const updated = changePropertyType(selectProperty, "select")
		expect(updated).toMatchObject({
			type: "select",
			options: selectProperty.options,
			defaultOptionId: selectProperty.defaultOptionId,
			optionSort: "manual",
		})
		expect(changePropertyType(selectProperty, "text")).toMatchObject({
			type: "text",
			options: undefined,
			optionSort: undefined,
		})
	})

	it("duplicates definitions with fresh option IDs and sorted views", () => {
		const secondOption = {
			id: "abababab-abab-4bab-8bab-abababababab",
			label: "Backlog",
			color: "gray" as const,
		}
		const schema: VaultSchema = {
			version: 1,
			properties: [
				{
					...selectProperty,
					options: [...(selectProperty.options ?? []), secondOption],
					optionSort: "alphabetical",
				},
			],
		}
		let id = 0
		const duplicate = duplicatePropertyDefinition(schema.properties[0], schema, {
			createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
			now: () => new Date("2026-06-14T00:00:00.000Z"),
		})

		expect(duplicate.name).toBe("Workflow copy")
		expect(duplicate.key).toBe("workflow-copy")
		expect(duplicate.id).not.toBe(selectProperty.id)
		expect(duplicate.options?.map((option) => option.id)).not.toEqual(
			selectProperty.options?.map((option) => option.id),
		)
		expect(getSortedPropertyOptions(schema.properties[0]).map((option) => option.label)).toEqual([
			"Backlog",
			"Done",
		])
	})

	it("registers and disposes custom property types", () => {
		const dispose = registerPropertyType({
			type: "rating",
			baseType: "number",
			displayName: "Rating",
			icon: "star",
			deserialize: (value) => value,
			serialize: (value) => value,
			validate: (value) => ({ valid: typeof value === "number" }),
		})
		expect(getPropertyType("rating")?.baseType).toBe("number")
		dispose()
		expect(getPropertyType("rating")).toBeUndefined()
		expect(() =>
			registerPropertyType({
				type: "invalid",
				baseType: "formula" as never,
				displayName: "Invalid",
				icon: "x",
				deserialize: (value) => value,
				serialize: (value) => value,
				validate: () => ({ valid: true }),
			}),
		).toThrow("invalid base type")
	})

	it("requires unique immutable keys and valid select defaults", () => {
		expect(defineProperty(selectProperty)).toEqual(selectProperty)
		expect(() =>
			validateVaultSchema({
				version: 1,
				properties: [selectProperty, { ...selectProperty, id: crypto.randomUUID() }],
			}),
		).toThrow("Duplicate property key")
		expect(() =>
			defineProperty({
				...selectProperty,
				defaultOptionId: "13131313-1313-4313-8313-131313131313",
			}),
		).toThrow("Unknown default select option")
		expect(() => defineProperty({ ...selectProperty, key: "author" })).toThrow(
			"must use the text type",
		)
	})
})

describe("property values", () => {
	it("handles empty values, dates, input coercion, and orphaned options", () => {
		expect(isEmptyPropertyValue("")).toBe(true)
		expect(isEmptyPropertyValue([])).toBe(true)
		expect(isEmptyPropertyValue(false)).toBe(false)
		expect(parsePropertyInput("number", "12.5")).toBe(12.5)
		expect(parsePropertyInput("text", "12.5")).toBe("12.5")
		expect(parsePropertyDate("2026-02-29")).toBeUndefined()
		const date = parsePropertyDate("2026-06-14")
		expect(date).toBeDefined()
		expect(serializePropertyDate(date!)).toBe("2026-06-14")
		expect(resolvePropertyOption(selectProperty, "missing")).toEqual({
			id: "missing",
			label: "Unknown",
			color: "gray",
		})
	})
})

describe("property schema store", () => {
	it("loads missing schemas and writes valid schemas atomically", async () => {
		const testRuntime = createTestPropertiesRuntime()
		expect(await getVaultSchema("/vault")).toEqual({ version: 1, properties: [] })
		await updateVaultSchema("/vault", { version: 1, properties: [selectProperty] })
		expect(testRuntime.atomicWrites).toEqual(["/vault/.cortex/schema/properties.json"])
		expect(await getVaultSchema("/vault")).toEqual({
			version: 1,
			properties: [selectProperty],
		})
	})

	it("does not rewrite malformed or unsupported schemas", async () => {
		const testRuntime = createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": '{"version":2,"properties":[]}',
		})
		await expect(getVaultSchema("/vault")).rejects.toThrow()
		expect(testRuntime.atomicWrites).toEqual([])
		testRuntime.files.set("/vault/.cortex/schema/properties.json", "{")
		await expect(getVaultSchema("/vault")).rejects.toThrow()
		expect(testRuntime.atomicWrites).toEqual([])
	})

	it("rejects key changes and preserves the schema after atomic write failures", async () => {
		const testRuntime = createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": JSON.stringify({
				version: 1,
				properties: [selectProperty],
			}),
		})
		await expect(
			updateVaultSchema("/vault", {
				version: 1,
				properties: [{ ...selectProperty, key: "renamed-workflow" }],
			}),
		).rejects.toThrow("immutable")
		testRuntime.runtime.files.atomicWriteFile = async () => {
			throw new Error("disk full")
		}
		await expect(updateVaultSchema("/vault", { version: 1, properties: [] })).rejects.toThrow(
			"disk full",
		)
		expect(await getVaultSchema("/vault")).toEqual({
			version: 1,
			properties: [selectProperty],
		})
	})
})
