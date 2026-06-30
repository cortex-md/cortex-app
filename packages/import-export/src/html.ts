import type { SanitizedMarkdownHtml } from "@cortex/renderer"
import { createRenderer, sanitizeRenderedMarkdownHtml } from "@cortex/renderer"

export function decodeHtmlEntities(value: string): string {
	const namedEntities: Record<string, string> = {
		amp: "&",
		apos: "'",
		gt: ">",
		lt: "<",
		nbsp: " ",
		quot: "\"",
	}
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, rawName: string) => {
		const name = rawName.toLocaleLowerCase()
		if (name.startsWith("#x")) {
			return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
		}
		if (name.startsWith("#")) {
			return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
		}
		return namedEntities[name] ?? entity
	})
}

export function htmlToMarkdown(content: string): string {
	const body = extractHtmlBody(content)
	const withoutUnsafeBlocks = body
		.replace(/<!--[\s\S]*?-->/gu, "")
		.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/giu, "")
	const withMarkdownLinks = withoutUnsafeBlocks
		.replace(/<img\b([^>]*)>/giu, (_match, attrs: string) => {
			const alt = readHtmlAttribute(attrs, "alt") ?? ""
			const src = readHtmlAttribute(attrs, "src")
			return src ? `![${cleanInlineText(alt)}](${src})` : ""
		})
		.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu, (_match, attrs: string, label: string) => {
			const href = readHtmlAttribute(attrs, "href")
			const text = cleanInlineText(label)
			return href ? `[${text || href}](${href})` : text
		})
		.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu, (_match, level: string, text: string) => {
			return `\n\n${"#".repeat(Number(level))} ${cleanInlineText(text)}\n\n`
		})
		.replace(/<li[^>]*>/giu, "\n- ")
		.replace(/<\/(p|div|section|article|header|footer|blockquote|pre|tr|ul|ol|li)>/giu, "\n\n")
		.replace(/<br\s*\/?>/giu, "\n")
		.replace(/<\/t[dh]>/giu, " | ")
		.replace(/<[^>]+>/gu, "")

	return normalizeMarkdownWhitespace(decodeHtmlEntities(withMarkdownLinks))
}

export async function renderMarkdownExportHtml(
	markdown: string,
	title: string,
): Promise<string> {
	const renderer = createRenderer({ surface: "export" })
	const rendered = await renderer.render(markdown)
	return createStandaloneHtml(rendered, title)
}

function createStandaloneHtml(html: SanitizedMarkdownHtml, title: string): string {
	const body = sanitizeRenderedMarkdownHtml(html)
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root {
	color: #1f2937;
	background: #ffffff;
	font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	line-height: 1.55;
}
body {
	margin: 0;
	background: #ffffff;
}
main {
	box-sizing: border-box;
	width: min(760px, 100%);
	margin: 0 auto;
	padding: 48px 28px 64px;
}
h1, h2, h3, h4, h5, h6 {
	color: #111827;
	line-height: 1.2;
	margin: 1.5em 0 0.5em;
}
h1:first-child, h2:first-child, h3:first-child {
	margin-top: 0;
}
p, ul, ol, blockquote, pre, table {
	margin: 0 0 1em;
}
a {
	color: #1d4ed8;
}
blockquote {
	border-left: 3px solid #d1d5db;
	color: #4b5563;
	padding-left: 1em;
}
code, pre {
	font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace;
}
pre {
	background: #f3f4f6;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	overflow-x: auto;
	padding: 0.875em 1em;
}
table {
	border-collapse: collapse;
	width: 100%;
}
th, td {
	border: 1px solid #d1d5db;
	padding: 0.375em 0.5em;
	text-align: left;
	vertical-align: top;
}
img {
	max-width: 100%;
}
@page {
	margin: 18mm;
}
@media print {
	main {
		width: auto;
		padding: 0;
	}
	a {
		color: inherit;
		text-decoration: underline;
	}
}
</style>
</head>
<body>
<main class="markdown-surface">
${body}
</main>
</body>
</html>`
}

function extractHtmlBody(content: string): string {
	const bodyMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/iu)
	return bodyMatch?.[1] ?? content
}

function readHtmlAttribute(attrs: string, name: string): string | null {
	const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "iu")
	const match = attrs.match(pattern)
	return decodeHtmlEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? "") || null
}

function cleanInlineText(value: string): string {
	return decodeHtmlEntities(value.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ").trim())
}

function normalizeMarkdownWhitespace(value: string): string {
	return value
		.split(/\r?\n/u)
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n")
		.trim()
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\"", "&quot;")
}
