import { parseFrontmatter, type VaultSchema } from "@cortex/properties"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	cleanupPropertyPanelTest,
	notePath,
	renderPanel,
	schemaPath,
	setupPropertyPanelTest,
} from "./propertyPanelTestUtils"

beforeEach(setupPropertyPanelTest)
afterEach(cleanupPropertyPanelTest)

describe("AddPropertyPopover", () => {
	it("creates a typed property from a search query", async () => {
		const { runtime } = await renderPanel({ version: 1, properties: [] }, "Body")

		await userEvent.click(await screen.findByRole("button", { name: "Add a property" }))
		await userEvent.type(
			await screen.findByPlaceholderText("Search or name a property..."),
			"Priority",
		)
		await userEvent.click(screen.getByText("Number"))

		await waitFor(() => {
			const schema = JSON.parse(runtime.files.get(schemaPath) ?? "{}") as VaultSchema
			expect(schema.properties).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ key: "priority", name: "Priority", type: "number" }),
				]),
			)
		})
		expect(await screen.findByText("Priority")).toBeInTheDocument()
	})

	it("registers observed scalar YAML keys without changing their values", async () => {
		const { runtime } = await renderPanel(
			{ version: 1, properties: [] },
			"---\npriority: 3\ntags: [work]\n---\nBody",
		)

		await userEvent.click(await screen.findByRole("button", { name: "Add a property" }))
		await userEvent.click(await screen.findByText("Priority"))

		await waitFor(() => {
			const schema = JSON.parse(runtime.files.get(schemaPath) ?? "{}") as VaultSchema
			expect(schema.properties[0]).toMatchObject({ key: "priority", type: "number" })
		})
		expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.priority).toBe(3)
		expect(screen.queryByText("Tags")).not.toBeInTheDocument()
	})
})
