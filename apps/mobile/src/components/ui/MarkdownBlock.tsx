"use dom"

import { type SanitizedMarkdownHtml, sanitizeRenderedMarkdownHtml } from "@cortex/renderer"
import { getSharedRenderer } from "@cortex/renderer/pipeline"
import { type CSSProperties, useEffect, useState } from "react"

const markdownStyles = `
html, body { margin: 0; padding: 0; background: transparent; }
.markdown-block { color: var(--text-primary); font-family: var(--font-ui); font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
.markdown-block > :first-child { margin-top: 0; }
.markdown-block > :last-child { margin-bottom: 0; }
.markdown-block a { color: var(--accent); }
.markdown-block code, .markdown-block pre { font-family: var(--font-editor); font-size: 0.9em; }
.markdown-block pre { background: var(--bg-secondary); border-radius: 8px; overflow-x: auto; padding: 10px 12px; }
.markdown-block blockquote { border-left: 3px solid var(--border); color: var(--text-secondary); margin-left: 0; padding-left: 12px; }
.markdown-block table { border-collapse: collapse; }
.markdown-block th, .markdown-block td { border: 1px solid var(--border); padding: 4px 8px; }
.markdown-block img { max-width: 100%; }
`

const externalLinkPattern = /^(https?:|mailto:)/iu

export default function MarkdownBlock({
	content,
	themeTokens,
	pluginStyles,
	onLinkPress,
}: {
	content: string
	themeTokens: Record<string, string>
	pluginStyles?: string
	onLinkPress?: (url: string) => Promise<void>
	dom?: import("expo/dom").DOMProps
}) {
	const [html, setHtml] = useState<SanitizedMarkdownHtml | "">("")

	useEffect(() => {
		let active = true
		void getSharedRenderer()
			.render(content)
			.then((renderedHtml) => {
				if (active) setHtml(renderedHtml)
			})
		return () => {
			active = false
		}
	}, [content])

	useEffect(() => {
		if (!onLinkPress) return
		const handleClick = (event: MouseEvent) => {
			if (!(event.target instanceof Element)) return
			const href = event.target.closest("a")?.getAttribute("href")
			if (!href || href.startsWith("#")) return
			event.preventDefault()
			if (externalLinkPattern.test(href)) void onLinkPress(href)
		}
		document.addEventListener("click", handleClick)
		return () => document.removeEventListener("click", handleClick)
	}, [onLinkPress])

	return (
		<>
			<style>{markdownStyles}</style>
			{pluginStyles ? <style>{pluginStyles}</style> : null}
			<div
				className="markdown-block markdown-surface"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown passes through the renderer sanitizer
				dangerouslySetInnerHTML={{ __html: sanitizeRenderedMarkdownHtml(html) }}
				style={themeTokens as CSSProperties}
			/>
		</>
	)
}
