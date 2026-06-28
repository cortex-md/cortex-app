import { describe, expect, it } from "vitest"
import {
	defaultDoc,
	docs,
	docsNavigation,
	docsSearchEntries,
	getDocBySlug,
	searchDocs,
} from "./registry"

describe("docs registry", () => {
	it("sorts documents by section and page order", () => {
		expect(defaultDoc.slug).toBe("get-started/welcome")
		expect(docs.map((doc) => doc.slug)).toEqual([
			"get-started/welcome",
			"get-started/quickstart",
			"workspace/local-markdown",
			"workspace/organizing",
			"sync/overview",
			"plugins/overview",
			"plugins/getting-started",
			"plugins/manifest-and-capabilities",
			"plugins/lifecycle-and-bundling",
			"plugins/commands-and-hotkeys",
			"plugins/vault-editor-workspace",
			"plugins/markdown-and-properties",
			"plugins/views-settings-and-ui",
			"plugins/storage-bookmarks-notifications",
			"plugins/publishing-and-review",
			"plugins/github-emoji-example",
			"themes/overview",
			"themes/getting-started",
			"themes/manifest",
			"themes/css-variables",
			"themes/stable-hooks-and-selectors",
			"themes/markdown-and-callouts",
			"themes/light-dark-and-system",
			"themes/publishing-and-review",
			"themes/best-practices",
			"developers/cli",
		])
	})

	it("groups sidebar navigation by topic", () => {
		expect(docsNavigation.map((group) => group.section)).toEqual([
			"Get Started",
			"Workspace",
			"Sync",
			"Plugin Development",
			"Theme Development",
			"Developer Tools",
		])
		expect(docsNavigation[0]?.pages.map((page) => page.title)).toEqual(["Welcome", "Quickstart"])
		expect(docsNavigation[3]?.pages.map((page) => page.title).slice(0, 3)).toEqual([
			"Community Plugins",
			"Getting Started With Plugins",
			"Manifest and Capabilities",
		])
		expect(docsNavigation[4]?.pages.map((page) => page.title).slice(0, 3)).toEqual([
			"Community Themes",
			"Getting Started With Themes",
			"Theme Manifest",
		])
	})

	it("finds pages by slug and rejects unknown slugs", () => {
		expect(getDocBySlug("sync/overview")?.title).toBe("Sync Overview")
		expect(getDocBySlug("plugins/overview")?.title).toBe("Community Plugins")
		expect(getDocBySlug("themes/overview")?.title).toBe("Community Themes")
		expect(getDocBySlug("missing")).toBeUndefined()
	})

	it("extracts table of contents headings and search text", () => {
		const page = getDocBySlug("plugins/overview")
		expect(page?.headings.map((heading) => heading.text)).toContain("Extension surfaces")
		expect(page?.headings.every((heading) => heading.depth === 2 || heading.depth === 3)).toBe(true)
		expect(searchDocs("encrypted blob").map((doc) => doc.slug)).toContain("sync/overview")
		expect(searchDocs("githubemoji").map((doc) => doc.slug)).toContain(
			"plugins/github-emoji-example",
		)
		expect(searchDocs("light.css").map((doc) => doc.slug)).toContain("themes/overview")
	})

	it("builds command search entries for pages and headings", () => {
		expect(docsSearchEntries.some((entry) => entry.id === "page:sync/overview")).toBe(true)
		expect(
			docsSearchEntries.some(
				(entry) =>
					entry.type === "heading" && entry.href === "/docs/plugins/overview#extension-surfaces",
			),
		).toBe(true)
	})
})
