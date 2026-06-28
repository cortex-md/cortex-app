import { noteCache } from "@cortex/core"
import { parseFrontmatter, type VaultSchema } from "@cortex/properties"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotePropertiesPanel } from "../../../features/properties/NotePropertiesPanel"
import { useNotePropertiesPanel } from "../../../features/properties/useNotePropertiesPanel"
import {
	cleanupPropertyPanelTest,
	initializePanelRuntime,
	notePath,
	renderPanel,
	schemaPath,
	setupPropertyPanelTest,
	uiStatePath,
} from "./propertyPanelTestUtils"

beforeEach(setupPropertyPanelTest)
afterEach(cleanupPropertyPanelTest)

describe("NotePropertiesPanel shell", () => {
	it("does not scan the vault while rendering a note", async () => {
		const runtime = initializePanelRuntime(
			{ version: 1, properties: [] },
			"---\npriority: 3\n---\nBody",
		)
		const listMarkdownFiles = vi
			.fn()
			.mockResolvedValue(Array.from({ length: 500 }, (_, index) => `/vault/note-${index}.md`))
		runtime.propertiesRuntime.notes.listMarkdownFiles = listMarkdownFiles
		await noteCache.read(notePath)

		render(<NotePropertiesPanel filePath={notePath} />)

		await screen.findByRole("button", { name: "Add a property" })
		expect(listMarkdownFiles).not.toHaveBeenCalled()
	})

	it("persists expansion state", async () => {
		const { runtime } = await renderPanel(
			{ version: 1, properties: [] },
			"---\npriority: 3\n---\nBody",
		)

		await userEvent.click(await screen.findByRole("button", { name: "Properties" }))
		await waitFor(() => {
			expect(JSON.parse(runtime.files.get(uiStatePath) ?? "{}").expanded["note.md"]).toBe(false)
		})
	})

	it("shows only creation time from the built-in default set on a clean note", async () => {
		await renderPanel(
			{
				version: 1,
				properties: [
					{
						id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
						key: "created-time",
						name: "Created time",
						type: "created_time",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
					{
						id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
						key: "note-id",
						name: "ID",
						type: "id",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
					{
						id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
						key: "edited-time",
						name: "Edited time",
						type: "last_edited_time",
						createdAt: "2026-06-13T00:00:00.000Z",
					},
					{
						id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
						key: "workflow",
						name: "Workflow",
						type: "select",
						createdAt: "2026-06-13T00:00:00.000Z",
						options: [
							{
								id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
								label: "Todo",
								color: "gray",
							},
						],
						defaultOptionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
					},
				],
			},
			"Body",
		)

		expect(await screen.findByText("Created time")).toBeInTheDocument()
		expect(screen.queryByText("ID")).not.toBeInTheDocument()
		expect(screen.queryByText("Edited time")).not.toBeInTheDocument()
		expect(screen.queryByText("Workflow")).not.toBeInTheDocument()
	})

	it("ignores a stale snapshot after switching notes", async () => {
		const slowPath = "/vault/slow.md"
		const fastPath = "/vault/fast.md"
		const runtime = initializePanelRuntime({ version: 1, properties: [] }, "Body")
		runtime.files.set(slowPath, "---\nproject: Slow\n---\nBody")
		runtime.files.set(fastPath, "---\nproject: Fast\n---\nBody")
		const originalReadNote = runtime.propertiesRuntime.notes.readNote
		let releaseSlowRead: (() => void) | undefined
		const slowRead = new Promise<void>((resolve) => {
			releaseSlowRead = resolve
		})
		runtime.propertiesRuntime.notes.readNote = async (path) => {
			if (path === slowPath) await slowRead
			return originalReadNote(path)
		}

		const { result, rerender } = renderHook(({ filePath }) => useNotePropertiesPanel(filePath), {
			initialProps: { filePath: slowPath },
		})
		rerender({ filePath: fastPath })

		await waitFor(() => expect(result.current.meta.project).toBe("Fast"))
		await act(async () => {
			releaseSlowRead?.()
			await slowRead
		})
		expect(result.current.meta.project).toBe("Fast")
	})

	it("clears the previous note properties while the next note snapshot is loading", async () => {
		const firstPath = "/vault/first.md"
		const secondPath = "/vault/second.md"
		const runtime = initializePanelRuntime({ version: 1, properties: [] }, "Body")
		runtime.files.set(firstPath, "---\nproject: First\n---\nBody")
		runtime.files.set(secondPath, "---\nproject: Second\n---\nBody")
		const originalReadNote = runtime.propertiesRuntime.notes.readNote
		let releaseSecondRead: (() => void) | undefined
		const secondRead = new Promise<void>((resolve) => {
			releaseSecondRead = resolve
		})
		runtime.propertiesRuntime.notes.readNote = async (path) => {
			if (path === secondPath) await secondRead
			return originalReadNote(path)
		}

		const { result, rerender } = renderHook(({ filePath }) => useNotePropertiesPanel(filePath), {
			initialProps: { filePath: firstPath },
		})
		await waitFor(() => expect(result.current.meta.project).toBe("First"))

		rerender({ filePath: secondPath })

		await waitFor(() => expect(result.current.meta.project).toBeUndefined())
		await act(async () => {
			releaseSecondRead?.()
			await secondRead
		})
		await waitFor(() => expect(result.current.meta.project).toBe("Second"))
	})

	it("does not show schema-backed properties on notes that do not persist them", async () => {
		const firstPath = "/vault/first.md"
		const secondPath = "/vault/second.md"
		const schema: VaultSchema = {
			version: 1,
			properties: [
				{
					id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
					key: "project",
					name: "Project",
					type: "text",
					createdAt: "2026-06-13T00:00:00.000Z",
				},
			],
		}
		const runtime = initializePanelRuntime(schema, "Body")
		runtime.files.set(firstPath, "---\nproject: Alpha\n---\nBody")
		runtime.files.set(secondPath, "Body")

		const { rerender } = render(<NotePropertiesPanel filePath={firstPath} />)

		expect(await screen.findByText("Project")).toBeInTheDocument()

		rerender(<NotePropertiesPanel filePath={secondPath} />)

		await waitFor(() => expect(screen.queryByText("Project")).not.toBeInTheDocument())
		await userEvent.click(screen.getByRole("button", { name: "Add a property" }))
		expect(await screen.findByText("Project")).toBeInTheDocument()
	})

	it("disables mutations until malformed YAML is fixed", async () => {
		const schema: VaultSchema = {
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
		}
		const { container, runtime } = await renderPanel(schema, "---\nbroken: [\n---\nBody")

		expect(
			await screen.findByText(/Properties are read-only until the YAML frontmatter is fixed/),
		).toBeInTheDocument()
		expect(container.querySelector(".note-properties-content")).toHaveAttribute(
			"aria-disabled",
			"true",
		)

		runtime.files.set(notePath, "---\nproject: Cortex\n---\nBody")
		noteCache.writeExternal(notePath, runtime.files.get(notePath)!)
		await waitFor(() =>
			expect(container.querySelector(".note-properties-content")).toHaveAttribute(
				"aria-disabled",
				"false",
			),
		)
		expect(parseFrontmatter(runtime.files.get(notePath) ?? "").meta.project).toBe("Cortex")
		expect(JSON.parse(runtime.files.get(schemaPath) ?? "{}")).toEqual(schema)
	})
})
