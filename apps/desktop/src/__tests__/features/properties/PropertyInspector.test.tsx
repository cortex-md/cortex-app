import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	cleanupPropertyPanelTest,
	renderPanel,
	schemaPath,
	setupPropertyPanelTest,
} from "./propertyPanelTestUtils"

beforeEach(setupPropertyPanelTest)
afterEach(cleanupPropertyPanelTest)

describe("Property inspector", () => {
	it("duplicates definitions through core factories without drag or help controls", async () => {
		const { container, runtime } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
						key: "project",
						name: "Project",
						type: "text",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\nproject: Cortex\n---\nBody",
		)

		await screen.findByText("Cortex")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-name")!)
		expect(container.querySelector(".note-property-drag-handle")).toBeNull()
		expect(container.querySelector(".note-property-name-help")).toBeNull()
		await userEvent.click(await screen.findByRole("button", { name: "Duplicate property" }))

		await waitFor(() => {
			const schema = JSON.parse(runtime.files.get(schemaPath) ?? "{}")
			expect(schema.properties.map((property: { name: string }) => property.name)).toEqual([
				"Project",
				"Project copy",
			])
			expect(schema.properties[1].id).not.toBe(schema.properties[0].id)
		})
	})
})
