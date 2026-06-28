import { createSystemSchema } from "./__tests__/fixtures/definitions"
import { createTestPropertiesRuntime } from "./__tests__/fixtures/runtime"
import { parseFrontmatter } from "./frontmatter"
import { createNoteWithPropertyDefaults, prepareDuplicatedNote, prepareNoteForSave } from "./system"

describe("system property metadata", () => {
	it("initializes only creation time for new notes", async () => {
		const testRuntime = createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": JSON.stringify(createSystemSchema()),
		})
		const created = await createNoteWithPropertyDefaults("/vault", "Body")
		const createdMeta = parseFrontmatter(created).meta
		expect(createdMeta).toEqual({
			"created-time": "2026-06-13T12:00:00.000Z",
		})
		testRuntime.runtime.now = () => new Date("2026-06-14T12:00:00.000Z")
		const saved = await prepareNoteForSave("/vault/note.md", created)
		const savedMeta = parseFrontmatter(saved).meta
		expect(savedMeta).toEqual({
			"created-time": "2026-06-13T12:00:00.000Z",
		})
		const duplicate = await prepareDuplicatedNote("/vault", created)
		expect(parseFrontmatter(duplicate).meta["created-time"]).toBe("2026-06-14T12:00:00.000Z")
	})

	it("never changes initialized creation fields or IDs", async () => {
		const testRuntime = createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": JSON.stringify(createSystemSchema()),
		})
		const raw =
			"---\nnote-id: stable-id\ncreated-time: 2020-01-01T00:00:00.000Z\ncreated-by: original-user\n---\nBody"
		testRuntime.runtime.now = () => new Date("2026-06-14T12:00:00.000Z")

		const saved = await prepareNoteForSave("/vault/note.md", raw)
		expect(parseFrontmatter(saved).meta).toMatchObject({
			"note-id": "stable-id",
			"created-time": "2020-01-01T00:00:00.000Z",
			"created-by": "original-user",
		})
	})

	it("updates existing edited fields on managed saves", async () => {
		const testRuntime = createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": JSON.stringify(createSystemSchema()),
		})
		Object.assign(testRuntime.authorContext, {
			authenticated: true,
			remoteVaultId: "remote",
			currentUserId: "user-1",
		})
		const raw = "---\nedited-time: 2020-01-01T00:00:00.000Z\nedited-by: old-user\n---\nBody"

		const saved = await prepareNoteForSave("/vault/note.md", raw)
		expect(parseFrontmatter(saved).meta).toMatchObject({
			"edited-time": "2026-06-13T12:00:00.000Z",
			"edited-by": "user-1",
		})
	})
})
