import { describe, expect, it } from "vitest"
import {
	addTagToFrontmatter,
	createDefaultFrontmatter,
	extractAllTags,
	extractInlineTags,
	extractYamlArray,
	hasFrontmatter,
	parseFrontmatter,
	removeTagFromFrontmatter,
	setTagsInFrontmatter,
	updateFrontmatterField,
} from "../utils/frontmatter"

describe("hasFrontmatter", () => {
	it("returns true when frontmatter block is present", () => {
		const content = "---\ntitle: Test\n---\nBody"
		expect(hasFrontmatter(content)).toBe(true)
	})

	it("returns false for plain text without frontmatter", () => {
		expect(hasFrontmatter("Just some text")).toBe(false)
	})

	it("returns false for partial frontmatter (only opening ---)", () => {
		expect(hasFrontmatter("---\ntitle: Test")).toBe(false)
	})

	it("returns false for empty string", () => {
		expect(hasFrontmatter("")).toBe(false)
	})
})

describe("parseFrontmatter", () => {
	it("parses tags as inline array", () => {
		const content = "---\ntags: [react, typescript]\n---\nBody"
		const result = parseFrontmatter(content)
		expect(result.hasFrontmatter).toBe(true)
		expect(result.frontmatter?.tags).toEqual(["react", "typescript"])
	})

	it("parses tags as block array", () => {
		const content = "---\ntags:\n  - react\n  - typescript\n---\nBody"
		const result = parseFrontmatter(content)
		expect(result.frontmatter?.tags).toEqual(["react", "typescript"])
	})

	it("parses created scalar field", () => {
		const content = "---\ncreated: 2024-01-01T00:00:00.000Z\ntags: []\n---\n"
		const result = parseFrontmatter(content)
		expect(result.frontmatter?.created).toBe("2024-01-01T00:00:00.000Z")
	})

	it("parses date scalar field", () => {
		const content = "---\ndate: 2024-01-01\ntags: []\n---\n"
		const result = parseFrontmatter(content)
		expect(result.frontmatter?.date).toBe("2024-01-01")
	})

	it("returns body without frontmatter block", () => {
		const content = "---\ntags: []\n---\nHello world"
		const result = parseFrontmatter(content)
		expect(result.body).toBe("Hello world")
	})

	it("returns hasFrontmatter: false for plain text", () => {
		const result = parseFrontmatter("No frontmatter here")
		expect(result.hasFrontmatter).toBe(false)
		expect(result.frontmatter).toBeNull()
		expect(result.body).toBe("No frontmatter here")
	})

	it("handles effectively empty frontmatter block (only whitespace)", () => {
		const content = "---\n \n---\nBody"
		const result = parseFrontmatter(content)
		expect(result.hasFrontmatter).toBe(true)
		expect(result.frontmatter?.tags).toEqual([])
		expect(result.frontmatter?.aliases).toEqual([])
	})

	it("returns empty body when no content after frontmatter", () => {
		const content = "---\ntags: []\n---\n"
		const result = parseFrontmatter(content)
		expect(result.body).toBe("")
	})
})

describe("extractYamlArray", () => {
	it("parses inline array format", () => {
		const yaml = "tags: [a, b, c]"
		expect(extractYamlArray(yaml, "tags")).toEqual(["a", "b", "c"])
	})

	it("parses block array format", () => {
		const yaml = "tags:\n  - a\n  - b"
		expect(extractYamlArray(yaml, "tags")).toEqual(["a", "b"])
	})

	it("returns empty array for empty inline array", () => {
		const yaml = "tags: []"
		expect(extractYamlArray(yaml, "tags")).toEqual([])
	})

	it("returns empty array when field is missing", () => {
		const yaml = "title: Test"
		expect(extractYamlArray(yaml, "tags")).toEqual([])
	})

	it("strips quotes from inline values", () => {
		const yaml = "tags: [\"react\", 'typescript']"
		expect(extractYamlArray(yaml, "tags")).toEqual(["react", "typescript"])
	})

	it("strips quotes from block values", () => {
		const yaml = "tags:\n  - \"react\"\n  - 'typescript'"
		expect(extractYamlArray(yaml, "tags")).toEqual(["react", "typescript"])
	})

	it("handles whitespace around values", () => {
		const yaml = "tags: [ react , typescript ]"
		expect(extractYamlArray(yaml, "tags")).toEqual(["react", "typescript"])
	})
})

describe("createDefaultFrontmatter", () => {
	it("generates valid frontmatter with only created by default", () => {
		const result = createDefaultFrontmatter({ created: "2024-01-01T00:00:00.000Z" })
		expect(result).toMatch(/^---\n/)
		expect(result).toContain("created: 2024-01-01T00:00:00.000Z")
		expect(result).not.toContain("tags:")
		expect(result).toMatch(/\n---\n$/)
	})

	it("includes provided tags in frontmatter", () => {
		const result = createDefaultFrontmatter({
			created: "2024-01-01T00:00:00.000Z",
			tags: ["react", "typescript"],
		})
		expect(result).toContain("- react")
		expect(result).toContain("- typescript")
	})

	it("includes extra fields", () => {
		const result = createDefaultFrontmatter({
			created: "2024-01-01T00:00:00.000Z",
			extraFields: { title: "My Note" },
		})
		expect(result).toContain("title: My Note")
	})

	it("uses current date when created is not provided", () => {
		const before = Date.now()
		const result = createDefaultFrontmatter()
		const after = Date.now()
		const createdMatch = result.match(/created: (.+)/)
		expect(createdMatch).not.toBeNull()
		const createdTime = new Date(createdMatch![1].trim()).getTime()
		expect(createdTime).toBeGreaterThanOrEqual(before)
		expect(createdTime).toBeLessThanOrEqual(after)
	})
})

describe("updateFrontmatterField", () => {
	it("updates an existing scalar field", () => {
		const content = "---\ntitle: Old Title\ntags: []\n---\nBody"
		const result = updateFrontmatterField(content, "title", "New Title")
		expect(result).toContain("title: New Title")
		expect(result).not.toContain("title: Old Title")
	})

	it("adds a new scalar field when not present", () => {
		const content = "---\ntags: []\n---\nBody"
		const result = updateFrontmatterField(content, "author", "Alice")
		expect(result).toContain("author: Alice")
	})

	it("updates an existing inline array field", () => {
		const content = "---\ntags: [old]\n---\nBody"
		const result = updateFrontmatterField(content, "tags", ["new1", "new2"])
		expect(result).toContain("- new1")
		expect(result).toContain("- new2")
		expect(result).not.toContain("[old]")
	})

	it("adds frontmatter if content has none", () => {
		const result = updateFrontmatterField("Plain text", "title", "My Note")
		expect(result).toMatch(/^---\n/)
		expect(result).toContain("title: My Note")
		expect(result).toContain("Plain text")
	})
})

describe("addTagToFrontmatter", () => {
	it("adds tag to existing inline array", () => {
		const content = "---\ntags: [react]\n---\nBody"
		const result = addTagToFrontmatter(content, "typescript")
		expect(result).toContain("typescript")
		expect(result).toContain("react")
	})

	it("does not duplicate existing tags (case-insensitive)", () => {
		const content = "---\ntags: [React]\n---\nBody"
		const result = addTagToFrontmatter(content, "react")
		const count = (result.match(/react/gi) ?? []).length
		expect(count).toBe(1)
	})

	it("adds tag to existing block array", () => {
		const content = "---\ntags:\n  - react\n---\nBody"
		const result = addTagToFrontmatter(content, "typescript")
		expect(result).toContain("typescript")
	})

	it("creates frontmatter with tag when no frontmatter exists", () => {
		const result = addTagToFrontmatter("Plain text", "react")
		expect(result).toMatch(/^---\n/)
		expect(result).toContain("react")
		expect(result).toContain("Plain text")
	})
})

describe("removeTagFromFrontmatter", () => {
	it("removes tag from inline array", () => {
		const content = "---\ntags: [react, typescript]\n---\nBody"
		const result = removeTagFromFrontmatter(content, "typescript")
		expect(result).not.toContain("typescript")
		expect(result).toContain("react")
	})

	it("removes tag from block array", () => {
		const content = "---\ntags:\n  - react\n  - typescript\n---\nBody"
		const result = removeTagFromFrontmatter(content, "typescript")
		expect(result).not.toContain("typescript")
	})

	it("is a no-op when tag is not present", () => {
		const content = "---\ntags: [react]\n---\nBody"
		const result = removeTagFromFrontmatter(content, "nonexistent")
		expect(result).toBe(content)
	})

	it("returns content unchanged when no frontmatter", () => {
		const content = "Plain text"
		expect(removeTagFromFrontmatter(content, "react")).toBe(content)
	})

	it("removes tag case-insensitively from inline array", () => {
		const content = "---\ntags: [React, TypeScript]\n---\n"
		const result = removeTagFromFrontmatter(content, "react")
		expect(result).not.toContain("React")
	})
})

describe("setTagsInFrontmatter", () => {
	it("replaces tags and deduplicates case-insensitively", () => {
		const content = "---\ntags: [old]\n---\nBody"
		const result = setTagsInFrontmatter(content, ["AWS", "aws", "certificado"])
		const parsed = parseFrontmatter(result)
		expect(parsed.frontmatter?.tags).toEqual(["AWS", "certificado"])
	})

	it("removes the tags field when the next list is empty", () => {
		const content = "---\ntitle: Cortex\ntags: [aws]\n---\nBody"
		const result = setTagsInFrontmatter(content, [])
		expect(result).toContain("title: Cortex")
		expect(result).not.toContain("tags:")
	})
})

describe("extractInlineTags", () => {
	it("finds hashtags in body text", () => {
		expect(extractInlineTags("Hello #react and #typescript")).toEqual(["react", "typescript"])
	})

	it("returns empty array when no hashtags", () => {
		expect(extractInlineTags("No tags here")).toEqual([])
	})

	it("deduplicates same tags", () => {
		expect(extractInlineTags("#react and #react again")).toEqual(["react"])
	})

	it("lowercases tags", () => {
		expect(extractInlineTags("#React #TypeScript")).toEqual(["react", "typescript"])
	})

	it("does not treat standalone # as a tag", () => {
		expect(extractInlineTags("# Heading")).toEqual([])
	})

	it("supports slash in tag names", () => {
		expect(extractInlineTags("#project/ideas")).toEqual(["project/ideas"])
	})
})

describe("extractAllTags", () => {
	it("combines YAML frontmatter tags and inline tags", () => {
		const content = "---\ntags: [react]\n---\nBody with #typescript"
		const tags = extractAllTags(content)
		expect(tags).toContain("react")
		expect(tags).toContain("typescript")
	})

	it("deduplicates tags from both sources", () => {
		const content = "---\ntags: [react]\n---\nBody with #react"
		const tags = extractAllTags(content)
		const reactCount = tags.filter((t) => t === "react").length
		expect(reactCount).toBe(1)
	})

	it("works with no frontmatter", () => {
		const tags = extractAllTags("Body with #react")
		expect(tags).toEqual(["react"])
	})

	it("works with no inline tags", () => {
		const content = "---\ntags: [react]\n---\nNo inline tags"
		expect(extractAllTags(content)).toEqual(["react"])
	})
})
