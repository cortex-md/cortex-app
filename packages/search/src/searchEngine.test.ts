import { describe, expect, it } from "vitest"
import { buildSearchMatches } from "./matches"
import { SearchEngine } from "./searchEngine"

function createSearchEngineWithDocument(content: string): SearchEngine {
	const searchEngine = new SearchEngine()
	searchEngine.addDocument("daily-note", "Daily note", content, "journal", 1)
	return searchEngine
}

describe("SearchEngine", () => {
	it("builds snippets around the earliest matching query term", () => {
		const [snippet] = buildSearchMatches(
			`alpha ${"middle ".repeat(20)} omega`,
			"omega alpha",
		).snippets

		expect(snippet.text.startsWith("alpha")).toBe(true)
		expect(snippet.text).not.toContain("omega")
	})

	it("escapes query terms before building the snippet matcher", () => {
		const [snippet] = buildSearchMatches(`literal c++ value ${"tail ".repeat(20)}`, "c++").snippets

		expect(snippet.text).toContain("c++")
	})

	it("finds terms deep in the body without serializing note content", () => {
		const searchEngine = createSearchEngineWithDocument(
			`${"preview ".repeat(1400)} deepneedle final body text`,
		)

		const [result] = searchEngine.search("deepneedle")
		const serialized = JSON.parse(JSON.stringify(searchEngine)) as {
			storedFields: Record<string, Record<string, unknown>>
		}
		const storedDocument = Object.values(serialized.storedFields)[0]

		expect(result.id).toBe("daily-note")
		expect(storedDocument.content).toBeUndefined()
		expect(storedDocument.preview).toBeUndefined()
	})

	it("limits full-text results to 100 by default", () => {
		const searchEngine = new SearchEngine()
		for (let index = 0; index < 150; index++) {
			searchEngine.addDocument(`note-${index}`, `Note ${index}`, "shared body", "", index)
		}

		expect(searchEngine.search("shared")).toHaveLength(100)
		expect(searchEngine.search("shared", { limit: 12 })).toHaveLength(12)
	})

	it("limits title results to 20", () => {
		const searchEngine = new SearchEngine()
		for (let index = 0; index < 30; index++) {
			searchEngine.addDocument(`note-${index}`, `Shared ${index}`, "body", "", index)
		}

		expect(searchEngine.searchTitles("shared")).toHaveLength(20)
	})
})
