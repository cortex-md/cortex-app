import { describe, expect, it } from "vitest"
import { utf8Decode, utf8Encode } from "../bytes"
import { attemptAutoMerge } from "../conflict"
import { hasConflictMarkers, mergeJson, mergeMarkdown, takeConflictSide } from "../merge"

const ancestor = "# Title\n\nfirst\nsecond\nthird\n"

describe("mergeMarkdown", () => {
	it("merges edits on different lines without conflicts", () => {
		const local = "# Title\n\nfirst local\nsecond\nthird\n"
		const remote = "# Title\n\nfirst\nsecond\nthird remote\n"

		expect(mergeMarkdown(ancestor, local, remote)).toEqual({
			kind: "clean",
			content: "# Title\n\nfirst local\nsecond\nthird remote\n",
		})
	})

	it("keeps both sides inside markers when the same line changes differently", () => {
		const local = "# Title\n\nfirst\nsecond local\nthird\n"
		const remote = "# Title\n\nfirst\nsecond remote\nthird\n"

		const result = mergeMarkdown(ancestor, local, remote)

		expect(result.kind).toBe("conflicts")
		expect(hasConflictMarkers(result.content)).toBe(true)
		expect(takeConflictSide(result.content, "local")).toBe(local)
		expect(takeConflictSide(result.content, "remote")).toBe(remote)
	})

	it("accepts identical concurrent edits as clean", () => {
		const edited = "# Title\n\nfirst\nsame edit\nthird\n"

		expect(mergeMarkdown(ancestor, edited, edited)).toEqual({ kind: "clean", content: edited })
	})

	it("does not lose a remote edit when local deleted a different line", () => {
		const local = "# Title\n\nsecond\nthird\n"
		const remote = "# Title\n\nfirst\nsecond\nthird edited\n"

		expect(mergeMarkdown(ancestor, local, remote)).toEqual({
			kind: "clean",
			content: "# Title\n\nsecond\nthird edited\n",
		})
	})

	it("conflicts when one side deletes a line the other side edited", () => {
		const local = "# Title\n\nfirst\nthird\n"
		const remote = "# Title\n\nfirst\nsecond edited\nthird\n"

		const result = mergeMarkdown(ancestor, local, remote)

		expect(result.kind).toBe("conflicts")
		expect(takeConflictSide(result.content, "remote")).toBe(remote)
	})
})

describe("mergeJson", () => {
	it("merges independent keys and lets remote win on the same key", () => {
		const base = JSON.stringify({ theme: "dark", font: 14, nested: { a: 1, b: 1 } })
		const local = JSON.stringify({ theme: "dark", font: 16, nested: { a: 2, b: 1 } })
		const remote = JSON.stringify({ theme: "light", font: 18, nested: { a: 1, b: 3 } })

		expect(JSON.parse(mergeJson(base, local, remote).content)).toEqual({
			theme: "light",
			font: 18,
			nested: { a: 2, b: 3 },
		})
	})
})

describe("attemptAutoMerge", () => {
	const bytes = (text: string) => utf8Encode(text)

	it("returns a conflict with both sides when the ancestor is unknown", async () => {
		const result = await attemptAutoMerge("note.md", bytes("local\n"), bytes("remote\n"), () =>
			Promise.resolve(null),
		)

		expect(result.kind).toBe("conflict")
		const text = utf8Decode(result.content)
		expect(takeConflictSide(text, "local")).toBe("local\n")
		expect(takeConflictSide(text, "remote")).toBe("remote\n")
	})

	it("keeps local bytes for files that are not mergeable text", async () => {
		const local = new Uint8Array([1, 2, 3])

		const result = await attemptAutoMerge("image.png", local, new Uint8Array([4]), () =>
			Promise.resolve(new Uint8Array()),
		)

		expect(result).toEqual({ kind: "merged", content: local })
	})

	it("falls back to conflict markers when a config file is not valid json", async () => {
		const result = await attemptAutoMerge(
			".cortex/settings.json",
			bytes("{ broken"),
			bytes('{"a":1}'),
			() => Promise.resolve(bytes("{}")),
		)

		expect(result.kind).toBe("conflict")
	})
})
