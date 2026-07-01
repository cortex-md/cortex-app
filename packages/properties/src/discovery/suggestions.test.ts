import { selectProperty } from "../__tests__/fixtures/definitions"
import { createTestPropertiesRuntime } from "../__tests__/fixtures/runtime"
import { invalidatePropertySuggestions, suggestProperties } from "./suggestions"

describe("property suggestions", () => {
	it("ranks schema and observed scalar suggestions while excluding reserved keys", async () => {
		createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": JSON.stringify({
				version: 1,
				properties: [
					{
						...selectProperty,
						id: crypto.randomUUID(),
						key: "project",
						name: "Project",
						type: "text",
						options: undefined,
						defaultOptionId: undefined,
					},
				],
			}),
			"/vault/one.md": "---\npriority: 2\ntags: [one]\ncortex-databases: [db]\n---\n",
			"/vault/two.md": "---\npriority: 3\naliases: [two]\n---\n",
		})
		const suggestions = await suggestProperties("pri", "/vault")
		const internalSuggestions = await suggestProperties("cortex", "/vault")
		expect(suggestions[0]).toMatchObject({
			key: "priority",
			type: "number",
			observed: true,
		})
		expect(suggestions.some((definition) => definition.key === "tags")).toBe(false)
		expect(internalSuggestions.some((definition) => definition.key === "cortex-databases")).toBe(
			false,
		)
	})

	it("shares one vault scan across simultaneous suggestion queries", async () => {
		const files = Object.fromEntries(
			Array.from({ length: 500 }, (_, index) => [
				`/vault/note-${index}.md`,
				`---\npriority: ${index}\n---\n`,
			]),
		)
		files["/vault/.cortex/schema/properties.json"] = JSON.stringify({
			version: 1,
			properties: [],
		})
		const testRuntime = createTestPropertiesRuntime(files)
		const originalReadNote = testRuntime.runtime.notes.readNote
		let noteReads = 0
		testRuntime.runtime.notes.readNote = async (path) => {
			noteReads++
			return originalReadNote(path)
		}
		invalidatePropertySuggestions("/vault")

		await Promise.all([
			suggestProperties("priority", "/vault"),
			suggestProperties("pri", "/vault"),
			suggestProperties("", "/vault"),
		])

		expect(noteReads).toBe(500)
	})

	it("limits concurrent note reads while building suggestions", async () => {
		const files = Object.fromEntries(
			Array.from({ length: 12 }, (_, index) => [
				`/vault/note-${index}.md`,
				`---\npriority: ${index}\n---\n`,
			]),
		)
		files["/vault/.cortex/schema/properties.json"] = JSON.stringify({
			version: 1,
			properties: [],
		})
		const testRuntime = createTestPropertiesRuntime(files)
		const originalReadNote = testRuntime.runtime.notes.readNote
		let activeReads = 0
		let maximumActiveReads = 0
		testRuntime.runtime.notes.readNote = async (path) => {
			activeReads++
			maximumActiveReads = Math.max(maximumActiveReads, activeReads)
			await new Promise((resolve) => setTimeout(resolve, 1))
			activeReads--
			return originalReadNote(path)
		}
		invalidatePropertySuggestions("/vault")

		await suggestProperties("priority", "/vault")

		expect(maximumActiveReads).toBeLessThanOrEqual(4)
	})

	it("serializes a rebuild requested during an active suggestion scan", async () => {
		const testRuntime = createTestPropertiesRuntime({
			"/vault/.cortex/schema/properties.json": JSON.stringify({
				version: 1,
				properties: [],
			}),
			"/vault/note.md": "---\npriority: 1\n---\n",
		})
		let releaseFirstScan: (() => void) | undefined
		const firstScanGate = new Promise<void>((resolve) => {
			releaseFirstScan = resolve
		})
		let scans = 0
		let activeScans = 0
		let maximumActiveScans = 0
		testRuntime.runtime.notes.listMarkdownFiles = async () => {
			scans++
			activeScans++
			maximumActiveScans = Math.max(maximumActiveScans, activeScans)
			if (scans === 1) await firstScanGate
			activeScans--
			return ["/vault/note.md"]
		}
		invalidatePropertySuggestions("/vault")

		const first = suggestProperties("", "/vault")
		await Promise.resolve()
		invalidatePropertySuggestions("/vault")
		const second = suggestProperties("priority", "/vault")
		releaseFirstScan?.()
		await Promise.all([first, second])

		expect(scans).toBe(2)
		expect(maximumActiveScans).toBe(1)
	})
})
