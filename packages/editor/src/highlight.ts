import type { EditorRuntimeModules } from "./types"

export function buildHighlightStyle(runtime: EditorRuntimeModules) {
	const { HighlightStyle, syntaxHighlighting } = runtime.language
	const { tags } = runtime.lezerHighlight
	return syntaxHighlighting(
		HighlightStyle.define([
			{
				tag: tags.heading1,
				fontWeight: "var(--heading-font-weight, 600)",
				fontSize: "var(--h1-font-size)",
				color: "var(--h1-color, var(--syntax-heading))",
			},
			{
				tag: tags.heading2,
				fontWeight: "var(--heading-font-weight, 600)",
				fontSize: "var(--h2-font-size)",
				color: "var(--h2-color, var(--syntax-heading))",
			},
			{
				tag: tags.heading3,
				fontWeight: "var(--heading-font-weight, 600)",
				fontSize: "var(--h3-font-size)",
				color: "var(--h3-color, var(--syntax-heading))",
			},
			{
				tag: tags.heading4,
				fontWeight: "var(--heading-font-weight, 600)",
				fontSize: "var(--h4-font-size)",
				color: "var(--h4-color, var(--syntax-heading))",
			},
			{
				tag: tags.heading5,
				fontWeight: "var(--heading-font-weight, 600)",
				fontSize: "var(--h5-font-size)",
				color: "var(--h5-color, var(--syntax-heading))",
			},
			{
				tag: tags.heading6,
				fontWeight: "var(--heading-font-weight, 600)",
				fontSize: "var(--h6-font-size)",
				color: "var(--h6-color, var(--syntax-heading))",
			},
			{ tag: tags.strong, fontWeight: "700" },
			{ tag: tags.emphasis, fontStyle: "italic" },
			{ tag: tags.strikethrough, textDecoration: "line-through" },
			{ tag: tags.link, color: "var(--link)", textDecoration: "underline" },
			{ tag: tags.url, color: "var(--text-muted)" },
			{ tag: tags.quote, color: "var(--text-muted)", fontStyle: "italic" },
			{ tag: tags.monospace, fontFamily: "var(--font-editor)", fontSize: "1em" },
			{ tag: tags.meta, color: "var(--syntax-meta)" },
			{ tag: tags.processingInstruction, color: "var(--syntax-meta)" },
			{ tag: tags.contentSeparator, color: "var(--syntax-meta)" },
			{ tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
			{ tag: tags.keyword, color: "var(--syntax-keyword)", fontWeight: "600" },
			{ tag: tags.string, color: "var(--syntax-string)" },
			{ tag: tags.number, color: "var(--syntax-number)" },
			{ tag: tags.bool, color: "var(--syntax-keyword)" },
			{ tag: tags.null, color: "var(--syntax-keyword)" },
			{ tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
			{ tag: tags.definition(tags.variableName), color: "var(--text-primary)" },
			{ tag: tags.variableName, color: "var(--text-primary)" },
			{ tag: tags.typeName, color: "var(--syntax-type)" },
			{ tag: tags.className, color: "var(--syntax-type)" },
			{ tag: tags.operator, color: "var(--syntax-operator)" },
			{ tag: tags.punctuation, color: "var(--text-muted)" },
			{ tag: tags.bracket, color: "var(--text-muted)" },
			{ tag: tags.propertyName, color: "var(--syntax-property)" },
			{ tag: tags.attributeName, color: "var(--syntax-property)" },
			{ tag: tags.tagName, color: "var(--syntax-keyword)" },
		]),
	)
}
