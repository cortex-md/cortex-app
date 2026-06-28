import {
	extractFrontmatterBody,
	FrontmatterParseError,
	parseFrontmatter,
	removeFrontmatterValue,
	replaceFrontmatterBody,
	serializeFrontmatter,
	setFrontmatterValue,
} from "./frontmatter"

describe("frontmatter", () => {
	it("parses and serializes property maps", () => {
		const parsed = parseFrontmatter("---\ntitle: Note\ncount: 2\n---\nBody")
		expect(parsed).toEqual({ meta: { title: "Note", count: 2 }, body: "Body" })
		expect(serializeFrontmatter(parsed.meta, parsed.body)).toBe(
			"---\ntitle: Note\ncount: 2\n---\nBody",
		)
	})

	it("preserves comments, ordering, unknown values, and CRLF line endings", () => {
		const source =
			"---\r\n# note\r\nfirst: one\r\nnested:\r\n  enabled: true\r\nlast: three\r\n---\r\nBody"
		const updated = setFrontmatterValue(source, "first", "changed")
		expect(updated).toContain(
			"# note\r\nfirst: changed\r\nnested:\r\n  enabled: true\r\nlast: three",
		)
		expect(/(^|[^\r])\n/.test(updated)).toBe(false)
	})

	it("removes empty frontmatter with the property", () => {
		expect(removeFrontmatterValue("---\nonly: value\n---\nBody", "only")).toBe("Body")
	})

	it("rejects malformed YAML without returning partial metadata", () => {
		expect(() => parseFrontmatter("---\nbroken: [\n---\nBody")).toThrow(FrontmatterParseError)
		expect(() => setFrontmatterValue("---\nbroken: [\n---\nBody", "title", "No")).toThrow(
			FrontmatterParseError,
		)
	})

	it("replaces only the body and preserves the frontmatter prefix byte-for-byte", () => {
		const source = "---\r\n# note\r\nfirst: one\r\nnested:\r\n  enabled: true\r\n---\r\nOld body"
		const updated = replaceFrontmatterBody(source, "New body\r\n")
		expect(updated).toBe(
			"---\r\n# note\r\nfirst: one\r\nnested:\r\n  enabled: true\r\n---\r\nNew body\r\n",
		)
		expect(extractFrontmatterBody(updated)).toBe("New body\r\n")
	})

	it("preserves malformed YAML while replacing an editable body", () => {
		const source = "---\nbroken: [\n---\nOld body"
		expect(replaceFrontmatterBody(source, "New body")).toBe("---\nbroken: [\n---\nNew body")
		expect(extractFrontmatterBody(source)).toBe("Old body")
	})
})
