import { describe, expect, it } from "vitest"
import { createLocalSearchBackend, type SearchIndexDocument } from "./backend"

function document(id: string, content: string): SearchIndexDocument {
	return {
		id,
		title: id,
		folder: "",
		content,
		mtime: 1,
		fingerprint: { mtime: 1, size: content.length },
	}
}

describe("local search backend note matches", () => {
	it("asks for content it has not cached, then reuses it", async () => {
		const backend = createLocalSearchBackend()
		expect(await backend.matchNotes("alpha", [{ id: "a.md" }])).toEqual([{ status: "missing" }])
		const [first] = await backend.matchNotes("alpha", [
			{ id: "a.md", raw: "---\ntags: [x]\n---\n# Title\n\nSome **alpha** text" },
		])
		expect(first?.status).toBe("matched")
		if (first?.status !== "matched") return
		expect(first.matches.count).toBe(1)
		expect(first.matches.snippets[0]?.text).not.toContain("**")
		expect(first.matches.snippets[0]?.text).not.toContain("tags")
		const [cached] = await backend.matchNotes("text", [{ id: "a.md" }])
		expect(cached?.status).toBe("matched")
	})

	it("drops cached content when a note is re-indexed or removed", async () => {
		const backend = createLocalSearchBackend()
		await backend.matchNotes("alpha", [
			{ id: "folder/a.md", raw: "alpha" },
			{ id: "b.md", raw: "alpha" },
		])
		await backend.addDocuments([document("b.md", "beta")])
		expect(await backend.matchNotes("alpha", [{ id: "b.md" }])).toEqual([{ status: "missing" }])
		await backend.removePaths(["folder"])
		expect(await backend.matchNotes("alpha", [{ id: "folder/a.md" }])).toEqual([
			{ status: "missing" },
		])
	})

	it("filters phrase candidates by the required text", async () => {
		const backend = createLocalSearchBackend()
		const results = await backend.matchNotes(
			"exact phrase",
			[
				{ id: "a.md", raw: "an exact phrase here" },
				{ id: "b.md", raw: "exact words, other phrase" },
			],
			{ requiredText: "Exact Phrase" },
		)
		expect(results.map((result) => result.status)).toEqual(["matched", "unmatched"])
	})

	it("returns short excerpts", async () => {
		const backend = createLocalSearchBackend()
		const [excerpt] = await backend.readNoteExcerpts([{ id: "a.md", raw: "one\n\ntwo   three" }], 9)
		expect(excerpt).toEqual({ status: "read", text: "one two …" })
	})
})
