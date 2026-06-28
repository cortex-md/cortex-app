import { noteCache, useTagsStore } from "@cortex/core"
import { parseFrontmatter } from "@cortex/properties"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotePropertiesPanel } from "../../../features/properties/NotePropertiesPanel"
import {
	cleanupPropertyPanelTest,
	initializePanelRuntime,
	notePath,
	renderPanel,
	schemaPath,
	setupPropertyPanelTest,
} from "./propertyPanelTestUtils"

beforeEach(setupPropertyPanelTest)
afterEach(cleanupPropertyPanelTest)

describe("Property value editors", () => {
	it("renders YAML tags as the first property without exposing inline tags as chips", async () => {
		const { container } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "11111111-1111-4111-8111-111111111111",
						key: "project",
						name: "Project",
						type: "text",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\ntags: [aws, certificado]\nproject: Cortex\n---\nBody #inline",
		)

		expect(await screen.findByText("aws")).toBeInTheDocument()
		expect(screen.getByText("certificado")).toBeInTheDocument()
		const rows = Array.from(container.querySelectorAll(".note-property-row"))
		expect(rows[0]).toHaveTextContent("tags")
		expect(screen.queryByText("inline")).not.toBeInTheDocument()
	})

	it("removes YAML tags through property chips and clears the field after the last chip", async () => {
		await renderPanel({ version: 1, properties: [] }, "---\ntags: [aws, certificado]\n---\nBody")

		await screen.findByText("aws")
		await userEvent.click(screen.getByRole("button", { name: "tags" }))
		await userEvent.click(await screen.findByRole("button", { name: "Remove aws" }))
		await waitFor(async () => {
			expect(parseFrontmatter(await noteCache.read(notePath)).meta.tags).toEqual(["certificado"])
		})

		await userEvent.click(await screen.findByRole("button", { name: "Remove certificado" }))
		await waitFor(async () => {
			expect(parseFrontmatter(await noteCache.read(notePath)).meta.tags).toBeUndefined()
		})
		expect(useTagsStore.getState().fileTags[notePath]).toEqual([])
	})

	it("reveals tags from Add property and adds a tag through autocomplete without writing schema", async () => {
		useTagsStore.setState({
			tagIndex: { aws: ["/vault/other.md"] },
			tagColors: {},
			fileTags: {},
			activeTagFilter: null,
		})
		const { runtime } = await renderPanel({ version: 1, properties: [] }, "Body")

		await userEvent.click(await screen.findByRole("button", { name: "Add a property" }))
		await userEvent.click(await screen.findByText("Tags"))

		expect(JSON.parse(runtime.files.get(schemaPath) ?? "{}").properties).toEqual([])
		expect(await screen.findByText("tags")).toBeInTheDocument()

		await userEvent.click(await screen.findByRole("button", { name: "tags" }))
		await userEvent.type(await screen.findByPlaceholderText("Add tag..."), "aw")
		await userEvent.click(await screen.findByText("aws"))

		await waitFor(async () => {
			expect(parseFrontmatter(await noteCache.read(notePath)).meta.tags).toEqual(["aws"])
		})
		expect(useTagsStore.getState().fileTags[notePath]).toEqual(["aws"])
	})

	it("shows tag colors as badges and edits the tag color from properties", async () => {
		useTagsStore.setState({
			tagIndex: { aws: [notePath] },
			tagColors: { aws: "#7c3aed" },
			fileTags: { [notePath]: ["aws"] },
			activeTagFilter: null,
		})
		const { container } = await renderPanel(
			{ version: 1, properties: [] },
			"---\ntags: [AWS]\n---\nBody",
		)

		expect(await screen.findByText("AWS")).toBeInTheDocument()
		expect(container.querySelector(".note-property-tag-chip")).toHaveAttribute(
			"data-has-color",
			"true",
		)

		await userEvent.click(screen.getByRole("button", { name: "tags" }))
		await userEvent.click(await screen.findByRole("button", { name: "Change color for AWS" }))
		expect(
			await screen.findByText((_, node) => node?.textContent === "Color for AWS"),
		).toBeInTheDocument()
		await userEvent.click(screen.getByRole("button", { name: "Red (#ef4444)" }))

		await waitFor(() => {
			expect(useTagsStore.getState().tagColors.aws).toBe("#ef4444")
		})
	})

	it("commits once when Enter closes a text editor before blur", async () => {
		const runtime = initializePanelRuntime(
			{
				version: 1,
				properties: [
					{
						id: "14141414-1414-4414-8414-141414141414",
						key: "project",
						name: "Project",
						type: "text",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\nproject: Cortex\n---\nBody",
		)
		const writeNote = vi.spyOn(runtime.propertiesRuntime.notes, "writeNote")
		await noteCache.read(notePath)
		const { container } = render(<NotePropertiesPanel filePath={notePath} />)

		await screen.findByText("Cortex")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		const input = await screen.findByRole("textbox", { name: "Project" })
		await userEvent.clear(input)
		await userEvent.type(input, "Atlas{Enter}")

		await waitFor(() => {
			expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.project).toBe("Atlas")
		})
		expect(writeNote).toHaveBeenCalledTimes(1)
	})

	it("saves simple property edits on blur", async () => {
		const { container, runtime } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "15151515-1515-4515-8515-151515151515",
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
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		const input = await screen.findByRole("textbox", { name: "Project" })
		await userEvent.clear(input)
		await userEvent.type(input, "Atlas")
		await userEvent.tab()

		await waitFor(() => {
			expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.project).toBe("Atlas")
		})
	})

	it("cancels inline simple property edits with Escape", async () => {
		const runtime = initializePanelRuntime(
			{
				version: 1,
				properties: [
					{
						id: "16161616-1616-4616-8616-161616161616",
						key: "project",
						name: "Project",
						type: "text",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\nproject: Cortex\n---\nBody",
		)
		const writeNote = vi.spyOn(runtime.propertiesRuntime.notes, "writeNote")
		await noteCache.read(notePath)
		const { container } = render(<NotePropertiesPanel filePath={notePath} />)

		await screen.findByText("Cortex")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		const input = await screen.findByRole("textbox", { name: "Project" })
		await userEvent.clear(input)
		await userEvent.type(input, "Atlas{Escape}")

		expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.project).toBe("Cortex")
		expect(writeNote).not.toHaveBeenCalled()
		expect(await screen.findByText("Cortex")).toBeInTheDocument()
	})

	it("keeps invalid inline values open without rewriting frontmatter", async () => {
		const runtime = initializePanelRuntime(
			{
				version: 1,
				properties: [
					{
						id: "17171717-1717-4717-8717-171717171717",
						key: "email",
						name: "Email",
						type: "email",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\nemail: ada@example.com\n---\nBody",
		)
		const writeNote = vi.spyOn(runtime.propertiesRuntime.notes, "writeNote")
		await noteCache.read(notePath)
		const { container } = render(<NotePropertiesPanel filePath={notePath} />)

		await screen.findByText("ada@example.com")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		const input = await screen.findByRole("textbox", { name: "Email" })
		await userEvent.clear(input)
		await userEvent.type(input, "not-an-email{Enter}")

		expect(await screen.findByText(/invalid/i)).toBeInTheDocument()
		expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.email).toBe("ada@example.com")
		expect(writeNote).not.toHaveBeenCalled()
		expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument()
	})

	it("removes simple properties when the inline value is cleared", async () => {
		const { container, runtime } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "18181818-1818-4818-8818-181818181818",
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
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		const input = await screen.findByRole("textbox", { name: "Project" })
		await userEvent.clear(input)
		await userEvent.type(input, "{Enter}")

		await waitFor(() => {
			expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.project).toBeUndefined()
		})
	})

	it("stores inline number edits as numbers", async () => {
		const { container, runtime } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "19191919-1919-4919-8919-191919191919",
						key: "priority",
						name: "Priority",
						type: "number",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\npriority: 1\n---\nBody",
		)

		await screen.findByText("1")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		const input = await screen.findByRole("spinbutton", { name: "Priority" })
		await userEvent.clear(input)
		await userEvent.type(input, "42{Enter}")

		await waitFor(() => {
			expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.priority).toBe(42)
		})
	})

	it("toggles checkbox properties directly from the row", async () => {
		const { container, runtime } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "20202020-2020-4020-8020-202020202020",
						key: "done",
						name: "Done",
						type: "checkbox",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\ndone: true\n---\nBody",
		)

		await screen.findByText("Checked")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)

		await waitFor(() => {
			expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.done).toBe(false)
		})
	})

	it("creates select options and stores their stable IDs", async () => {
		const { container, runtime } = await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
						key: "role",
						name: "Role",
						type: "select",
						createdAt: "2026-06-13T00:00:00.000Z",
						options: [],
						optionSort: "manual",
					},
				],
			},
			"Body",
		)
		await userEvent.click(await screen.findByRole("button", { name: "Add a property" }))
		await userEvent.click(await screen.findByText("Role"))
		await screen.findByText("Empty")
		await userEvent.click(container.querySelector<HTMLButtonElement>(".note-property-value")!)
		await userEvent.type(
			await screen.findByPlaceholderText("Select an option or create one"),
			"Reviewer",
		)
		await userEvent.click(screen.getByText("Create “Reviewer”"))

		await waitFor(() => {
			const schema = JSON.parse(runtime.files.get(schemaPath) ?? "{}")
			const option = schema.properties[0].options?.[0]
			expect(option).toMatchObject({ label: "Reviewer" })
			expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.role).toBe(option?.id)
		})
	})

	it("renders orphaned options and remote people without rewriting values", async () => {
		const runtime = initializePanelRuntime(
			{
				version: 1,
				properties: [
					{
						id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
						key: "workflow",
						name: "Workflow",
						type: "select",
						createdAt: "2026-06-13T00:00:00.000Z",
						options: [
							{
								id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
								label: "Done",
								color: "green",
							},
						],
					},
					{
						id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
						key: "author",
						name: "Author",
						type: "text",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\nworkflow: orphaned\nauthor: user-1\n---\nBody",
		)
		Object.assign(runtime.authorContext, {
			authenticated: true,
			remoteVaultId: "remote-vault",
			currentUserId: "user-1",
			members: [{ id: "user-1", label: "Ada", email: "ada@example.com" }],
		})
		await noteCache.read(notePath)
		const { container } = render(<NotePropertiesPanel filePath={notePath} />)

		expect(await screen.findByText("Unknown")).toBeInTheDocument()
		expect(await screen.findByText("Ada")).toBeInTheDocument()
		const authorRow = Array.from(container.querySelectorAll(".note-property-row")).find((row) =>
			row.textContent?.includes("Author"),
		)
		await userEvent.click(authorRow!.querySelector<HTMLButtonElement>(".note-property-value")!)
		expect(await screen.findByPlaceholderText("Search for people...")).toBeInTheDocument()
		expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.workflow).toBe("orphaned")
	})

	it("renders system actors through the shared identity model", async () => {
		const runtime = initializePanelRuntime(
			{
				version: 1,
				properties: [
					{
						id: "12121212-1212-4212-8212-121212121212",
						key: "created-by",
						name: "Created by",
						type: "created_by",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
					{
						id: "13131313-1313-4313-8313-131313131313",
						key: "edited-by",
						name: "Edited by",
						type: "last_edited_by",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
				],
			},
			"---\ncreated-by: user-1\nedited-by: device:desktop-test\n---\nBody",
		)
		Object.assign(runtime.authorContext, {
			authenticated: true,
			remoteVaultId: "remote-vault",
			currentUserId: "user-1",
			members: [{ id: "user-1", label: "Ada", email: "ada@example.com" }],
		})
		await noteCache.read(notePath)
		render(<NotePropertiesPanel filePath={notePath} />)

		expect(await screen.findByText("Ada")).toBeInTheDocument()
		expect(await screen.findByText("Test device")).toBeInTheDocument()
		expect(screen.queryByText("user-1")).not.toBeInTheDocument()
		expect(screen.queryByText("device:desktop-test")).not.toBeInTheDocument()
	})
})
