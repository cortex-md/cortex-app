# Markdown and Properties

Markdown extensions require the `markdown:extensions` capability. Property type extensions require
`properties:types`.

## Inline Replacements

Use inline registrations for simple regex replacements:

```ts
this.registerMarkdownInline({
	id: "smile-shortcode",
	pattern: ":smile:",
	replacement: { type: "text", content: "smile" },
})
```

Inline registrations are lightweight and shared by editor and renderer consumers.

## Semantic Transforms

Use semantic registrations when output should work across Live Preview, Reading View, and export.
Semantic output must be portable nodes, not arbitrary DOM.

```ts
this.registerMarkdownSemantic({
	id: "ticket-links",
	selector: { type: "text" },
	priority: 10,
	transform: ({ node }) => {
		if (node.type !== "text" || !node.value.includes("APP-")) return null
		return node
	},
})
```

Supported portable nodes include text, container, span, link, image, and code.

## Callout Types

```ts
this.registerCalloutType({
	type: "decision",
	aliases: ["decide"],
	label: "Decision",
	color: "var(--accent)",
	backgroundColor: "var(--accent-subtle)",
})
```

Later registrations win. Disposing a registration restores the previous definition.

## Preprocessors and Unified Processors

Preprocessors and Unified processors run only on `reading-view` and `export` surfaces:

```ts
this.registerMarkdownPreprocessor({
	id: "append-footer",
	surfaces: ["reading-view"],
	preprocess: (markdown) => `${markdown}\n\n---\nRendered by plugin.`,
})
```

Live Preview integrations should use inline registrations, semantic registrations, callouts, fold
providers, or editor extensions instead.

## Plugin `styles.css`

A plugin can include a root `styles.css` file only when it declares `markdown:extensions`.

Plugin CSS is scoped to `.markdown-surface`. Selectors that do not already target
`.markdown-surface` are prefixed by the host. Selectors that escape the Markdown surface with
sibling combinators are rejected.

Allowed at-rules:

- `@container`
- `@layer`
- `@media`
- `@supports`

Blocked at-rules include `@font-face`, `@import`, `@keyframes`, `@namespace`, and `@page`.

## Property Types

```ts
this.registerPropertyType({
	type: "rating",
	baseType: "number",
	displayName: "Rating",
	icon: "star",
	deserialize: (value) => Number(value ?? 0),
	serialize: (value) => Number(value ?? 0),
	validate: (value) => ({
		valid: typeof value === "number" && value >= 0 && value <= 5,
		message: "Rating must be between 0 and 5",
	}),
})
```

Property type ids are namespaced internally by plugin id.

