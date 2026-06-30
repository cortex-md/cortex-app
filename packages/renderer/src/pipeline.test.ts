import { describe, expect, it } from "vitest"
import { detectRendererFeatureFlags } from "./features"
import { createRenderer, getSharedRenderer } from "./pipeline"
import {
	registerMarkdownInline,
	registerMarkdownPreprocessor,
	registerMarkdownProcessor,
	registerMarkdownSemantic,
} from "./registry"

describe("callout rendering", () => {
	it("renders static callouts with rich content", async () => {
		const html = await getSharedRenderer().render(
			"> [!warning] **Custom title**\n>\n> Body with *emphasis*.",
		)

		expect(html).toContain('<aside class="markdown-callout"')
		expect(html).toContain('data-callout="warning"')
		expect(html).toContain("<strong>Custom title</strong>")
		expect(html).toContain("<em>emphasis</em>")
	})

	it("renders expanded and collapsed callouts with explicit state", async () => {
		const renderer = getSharedRenderer()
		const expanded = await renderer.render("> [!tip]+\n> Visible")
		const collapsed = await renderer.render("> [!tip]-\n> Hidden")

		expect(expanded).toContain('<details class="markdown-callout is-collapsible"')
		expect(expanded).toContain('data-callout-fold="+"')
		expect(expanded).toContain(" open")
		expect(collapsed).toContain('class="markdown-callout is-collapsible is-collapsed"')
		expect(collapsed).toContain('data-callout-fold="-"')
		expect(collapsed).not.toContain(" open")
	})
})

describe("shared renderer registries", () => {
	it("updates inline registrations reactively and skips code", async () => {
		const dispose = registerMarkdownInline({
			id: "wave",
			pattern: ":wave:",
			replacement: { type: "text", content: "hello" },
		})

		const registered = await getSharedRenderer().render(":wave: `:wave:`")
		expect(registered).toContain("<p>hello <code>:wave:</code></p>")

		dispose()
		const disposed = await getSharedRenderer().render(":wave:")
		expect(disposed).toContain("<p>:wave:</p>")
	})

	it("strips frontmatter without rendering a duplicate properties card", async () => {
		const html = await getSharedRenderer().render(`---
title: "A: structured value"
tags:
  - markdown
  - cortex
---

Body`)

		expect(html).toBe("<p>Body</p>")
	})

	it("resolves overlapping inline registrations by priority against the source text", async () => {
		const disposeLow = registerMarkdownInline({
			id: "overlap-low",
			pattern: "ab",
			priority: 0,
			replacement: { type: "text", content: "X" },
		})
		const disposeHigh = registerMarkdownInline({
			id: "overlap-high",
			pattern: "a",
			priority: 10,
			replacement: { type: "text", content: "Y" },
		})

		expect(await getSharedRenderer().render("ab")).toContain("<p>Yb</p>")

		disposeHigh()
		disposeLow()
	})

	it("renders portable semantic output and sanitizes its URLs", async () => {
		const dispose = registerMarkdownSemantic({
			id: "semantic-link",
			selector: { type: "text" },
			transform: ({ source }) =>
				source === "unsafe"
					? {
							type: "link",
							href: "javascript:alert(1)",
							children: [{ type: "text", value: "blocked" }],
						}
					: null,
		})

		const html = await getSharedRenderer().render("unsafe")
		expect(html).toContain("<a>blocked</a>")
		expect(html).not.toContain("javascript:")

		dispose()
	})

	it("composes semantic registrations and inline replacements", async () => {
		const disposeInline = registerMarkdownInline({
			id: "semantic-inline",
			pattern: ":wave:",
			replacement: { type: "text", content: "hello" },
		})
		const disposeInner = registerMarkdownSemantic({
			id: "semantic-inner",
			selector: { type: "text" },
			priority: 0,
			transform: ({ source }) => (source === "wrapped" ? { type: "text", value: ":wave:" } : null),
		})
		const disposeOuter = registerMarkdownSemantic({
			id: "semantic-outer",
			selector: { type: "text" },
			priority: 10,
			transform: ({ source }) =>
				source === "compose"
					? {
							type: "span",
							className: "semantic-output",
							children: [{ type: "text", value: "wrapped" }],
						}
					: null,
		})

		expect(await getSharedRenderer().render("compose")).toContain(
			'<span class="semantic-output">hello</span>',
		)

		disposeOuter()
		disposeInner()
		disposeInline()
	})
})

describe("processor isolation and sanitization", () => {
	it("detects renderer feature flags from preprocessed markdown", () => {
		expect(
			detectRendererFeatureFlags("plain paragraph with a [link](https://example.com)", {
				hasTextTransforms: false,
			}),
		).toEqual({
			hasCallouts: false,
			hasWikiLinks: false,
			hasTaskLists: false,
			hasCodeBlocks: false,
			hasTextTransforms: false,
			hasTables: false,
			hasGfmSyntax: false,
			hasMath: false,
		})
		expect(
			detectRendererFeatureFlags(
				"> [!tip]\n> [[Link]]\n\n- [x] Task\n\n```ts\nx\n```\n\n| A | B |\n| --- | --- |",
				{
					hasTextTransforms: true,
				},
			),
		).toEqual({
			hasCallouts: true,
			hasWikiLinks: true,
			hasTaskLists: true,
			hasCodeBlocks: true,
			hasTextTransforms: true,
			hasTables: true,
			hasGfmSyntax: false,
			hasMath: false,
		})
	})

	it("runs preprocessors before parsing only on their declared surface", async () => {
		const dispose = registerMarkdownPreprocessor({
			id: "export-frontmatter",
			surfaces: ["export"],
			priority: 10,
			preprocess: (markdown) => markdown.replace("{{title}}", "Exported"),
		})

		expect(await createRenderer({ surface: "reading-view" }).render("# {{title}}")).toContain(
			"<h1>{{title}}</h1>",
		)
		expect(await createRenderer({ surface: "export" }).render("# {{title}}")).toContain(
			"<h1>Exported</h1>",
		)

		dispose()
	})

	it("orders preprocessors by priority and isolates failures", async () => {
		const disposeLow = registerMarkdownPreprocessor({
			id: "preprocessor-low",
			surfaces: ["reading-view"],
			priority: 0,
			preprocess: (markdown) => `${markdown}L`,
		})
		const disposeFailure = registerMarkdownPreprocessor({
			id: "preprocessor-failure",
			surfaces: ["reading-view"],
			priority: 5,
			preprocess: () => {
				throw new Error("preprocessor failed")
			},
		})
		const disposeHigh = registerMarkdownPreprocessor({
			id: "preprocessor-high",
			surfaces: ["reading-view"],
			priority: 10,
			preprocess: (markdown) => `${markdown}H`,
		})

		expect(await createRenderer().render("body")).toContain("<p>bodyHL</p>")

		disposeHigh()
		disposeFailure()
		disposeLow()
	})

	it("runs processors only on their declared surface and phase", async () => {
		const dispose = registerMarkdownProcessor({
			id: "export-only",
			phase: "rehype",
			surfaces: ["export"],
			processor: () => (tree: unknown) => {
				const root = tree as { children: Array<{ type: string; value: string }> }
				root.children.unshift({ type: "text", value: "export:" })
			},
		})

		expect(await createRenderer({ surface: "reading-view" }).render("body")).not.toContain(
			"export:",
		)
		expect(await createRenderer({ surface: "export" }).render("body")).toContain("export:")

		dispose()
	})

	it("orders processors by priority and isolates failures", async () => {
		const append = (value: string) => () => (tree: unknown) => {
			const root = tree as {
				children: Array<{ children?: Array<{ type: string; value?: string }> }>
			}
			const text = root.children[0]?.children?.[0]
			if (text) text.value = `${text.value ?? ""}${value}`
		}
		const disposeLow = registerMarkdownProcessor({
			id: "processor-low",
			phase: "rehype",
			surfaces: ["reading-view"],
			priority: 0,
			processor: append("L"),
		})
		const disposeFailure = registerMarkdownProcessor({
			id: "processor-failure",
			phase: "rehype",
			surfaces: ["reading-view"],
			priority: 5,
			processor: () => () => {
				throw new Error("processor failed")
			},
		})
		const disposeHigh = registerMarkdownProcessor({
			id: "processor-high",
			phase: "rehype",
			surfaces: ["reading-view"],
			priority: 10,
			processor: append("H"),
		})

		expect(await createRenderer().render("body")).toContain("<p>bodyHL</p>")

		disposeHigh()
		disposeFailure()
		disposeLow()
	})

	it("keeps built-in transforms enabled when custom processors are active", async () => {
		const dispose = registerMarkdownProcessor({
			id: "inject-wiki-link",
			phase: "rehype",
			surfaces: ["reading-view"],
			processor: () => (tree: unknown) => {
				const root = tree as { children: unknown[] }
				root.children = [{ type: "text", value: "[[Injected]]" }]
			},
		})

		const html = await createRenderer().render("plain")

		expect(html).toContain('data-wiki-link="Injected"')
		dispose()
	})

	it("renders GFM syntax only when the document needs it", async () => {
		const renderer = createRenderer()

		const table = await renderer.render(
			"| A | B | C | D |\n| --- | ---: | --- | --- |\n| **bold** | [link](https://example.com) | [[Wiki 1]] | [[Target|Label]] |",
		)

		expect(table).toContain("<table>")
		expect(table).toContain("<strong>bold</strong>")
		expect(table).toContain('<td align="right">')
		expect(table).toContain('<a href="https://example.com">link</a>')
		expect(table).toContain('data-wiki-link="Wiki 1"')
		expect(table).toContain('data-wiki-link="Target"')
		expect(table).toContain(">Label</a>")
		expect(await renderer.render("~~removed~~")).toContain("<del>removed</del>")
		expect(await renderer.render("visit https://example.com")).toContain(
			'<a href="https://example.com">https://example.com</a>',
		)
		expect(await renderer.render("[link](https://example.com)")).toBe(
			'<p><a href="https://example.com">link</a></p>',
		)
	})

	it("sanitizes dangerous Markdown and processor output", async () => {
		const dispose = registerMarkdownProcessor({
			id: "unsafe-output",
			phase: "rehype",
			surfaces: ["reading-view"],
			processor: () => (tree: unknown) => {
				const root = tree as { children: unknown[] }
				root.children.unshift(
					{
						type: "element",
						tagName: "script",
						properties: {},
						children: [{ type: "text", value: "alert(1)" }],
					},
					{
						type: "element",
						tagName: "a",
						properties: { href: "javascript:alert(1)", onclick: "alert(1)" },
						children: [{ type: "text", value: "unsafe" }],
					},
					{
						type: "element",
						tagName: "img",
						properties: { src: "data:text/html;base64,PHNjcmlwdD4=" },
						children: [],
					},
				)
			},
		})

		const html = await createRenderer().render("[link](javascript:alert(1))")
		expect(html).not.toContain("<script")
		expect(html).not.toContain("javascript:")
		expect(html).not.toContain("onclick")
		expect(html).not.toContain("data:text/html")

		dispose()
	})

	it("keeps internal task metadata through final sanitization", async () => {
		const html = await createRenderer().render("- [x] done")

		expect(html).toContain('data-task-item="checked"')
		expect(html).toMatch(/data-offset="\d+"/)
		expect(html).toContain('data-task-checkbox="true"')
	})
})

describe("math rendering", () => {
	it("renders guarded inline and block math delimiters", async () => {
		const html = await createRenderer().render("Inline $x^2$.\n\n$$\ny=x+1\n$$")

		expect(html).toContain('class="markdown-math-inline"')
		expect(html).toContain('class="markdown-math-block"')
		expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>')
		expect(html).toContain('<annotation encoding="application/x-tex">y=x+1</annotation>')
	})

	it("renders backslash inline and block math delimiters", async () => {
		const html = await createRenderer().render("Inline \\(x^2\\).\n\n\\[\ny=x\n\\]")

		expect(html).toContain('class="markdown-math-inline"')
		expect(html).toContain('class="markdown-math-block"')
		expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>')
		expect(html).toContain('<annotation encoding="application/x-tex">y=x</annotation>')
	})

	it("does not treat money as inline math", async () => {
		const html = await createRenderer().render("Price is $20 and $30 today.")

		expect(html).toBe("<p>Price is $20 and $30 today.</p>")
		expect(
			detectRendererFeatureFlags("Price is $20 and $30 today.", { hasTextTransforms: false })
				.hasMath,
		).toBe(false)
	})

	it("keeps formula errors local", async () => {
		const html = await createRenderer().render("Broken $\\frac{1$ after.")

		expect(html).toContain("katex-error")
		expect(html).toContain("after")
	})

	it("sanitizes dangerous math output and non-math span styles", async () => {
		const dispose = registerMarkdownProcessor({
			id: "unsafe-span-style",
			phase: "rehype",
			surfaces: ["reading-view"],
			processor: () => (tree: unknown) => {
				const root = tree as { children: unknown[] }
				root.children.unshift({
					type: "element",
					tagName: "span",
					properties: { style: "position:fixed;inset:0", onclick: "alert(1)" },
					children: [{ type: "text", value: "unsafe" }],
				})
			},
		})

		const html = await createRenderer().render("$x^2$")

		expect(html).toContain("unsafe")
		expect(html).not.toContain("position:fixed")
		expect(html).not.toContain("onclick")
		expect(html).toContain('style="height:')
		dispose()
	})
})
