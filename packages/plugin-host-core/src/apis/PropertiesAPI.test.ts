import { getPropertyType, resetCustomPropertyTypes } from "@cortex/properties"
import { beforeEach, describe, expect, it } from "vitest"
import { pluginStore } from "../pluginStore"
import { createPropertiesAPI, disposePluginPropertyTypes } from "./PropertiesAPI"

beforeEach(() => {
	resetCustomPropertyTypes()
	pluginStore.getState().reset()
	pluginStore.getState().registerPlugin({
		id: "property-test",
		name: "Property Test",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Test plugin",
		icon: "star",
		main: "index.ts",
		capabilities: ["properties:types"],
	})
})

describe("PropertiesAPI", () => {
	it("registers namespaced property types and disposes them on unload", () => {
		createPropertiesAPI("property-test").registerType({
			type: "rating",
			baseType: "number",
			displayName: "Rating",
			icon: "star",
			deserialize: (value) => value,
			serialize: (value) => value,
			validate: (value) => ({ valid: typeof value === "number" }),
		})
		expect(getPropertyType("property-test:rating")?.displayName).toBe("Rating")
		disposePluginPropertyTypes("property-test")
		expect(getPropertyType("property-test:rating")).toBeUndefined()
	})

	it("requires the properties capability", () => {
		expect(() =>
			createPropertiesAPI("missing").registerType({
				type: "rating",
				baseType: "number",
				displayName: "Rating",
				icon: "star",
				deserialize: (value) => value,
				serialize: (value) => value,
				validate: () => ({ valid: true }),
			}),
		).toThrow("properties:types")
	})
})
