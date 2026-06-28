import { describe, expect, it } from "vitest"
import { createDocLlmText, createDocsLlmCorpus, createLlmsIndex } from "./llms"
import { getDocBySlug } from "./registry"

describe("docs llm helpers", () => {
	it("creates llm-readable text for a single page", () => {
		const page = getDocBySlug("sync/overview")
		expect(page).toBeTruthy()
		if (!page) throw new Error("Expected sync overview doc to exist")

		const text = createDocLlmText(page)

		expect(text).toContain("# Sync Overview")
		expect(text).toContain("Source: https://cortex-md.tech/docs/sync/overview")
		expect(text).toContain("client-side encryption")
		expect(text).not.toMatch(/^---/u)
	})

	it("creates an llms index and full docs corpus", () => {
		const index = createLlmsIndex()
		const corpus = createDocsLlmCorpus()

		expect(index).toContain("Full docs corpus: https://cortex-md.tech/docs/llms.txt")
		expect(index).toContain("- [Welcome](https://cortex-md.tech/docs/get-started/welcome)")
		expect(corpus).toContain("# Cortex Documentation")
		expect(corpus).toContain("# Cortex CLI")
		expect(corpus).toContain("```sh")
	})
})
