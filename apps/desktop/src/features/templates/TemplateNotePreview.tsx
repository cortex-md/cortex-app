import { parseFrontmatter } from "@cortex/properties"
import { cn } from "@cortex/ui"
import { useMemo } from "react"

interface TemplateNotePreviewProps {
	content: string
	title?: string
	className?: string
}

interface PreviewLine {
	key: string
	kind: "heading" | "task" | "bullet" | "text"
	level: number
	text: string
	done: boolean
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return ""
	if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ")
	if (value instanceof Date) return value.toISOString().slice(0, 10)
	if (typeof value === "object") return JSON.stringify(value)
	return String(value)
}

function parseLines(body: string): PreviewLine[] {
	const lines: PreviewLine[] = []
	for (const [index, raw] of body.split(/\r?\n/).entries()) {
		const line = raw.trimEnd()
		if (!line.trim()) continue
		const heading = /^(#{1,6})\s+(.*)$/.exec(line)
		const task = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/.exec(line)
		const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
		const key = `${index}:${line}`
		if (heading) {
			lines.push({ key, kind: "heading", level: heading[1].length, text: heading[2], done: false })
		} else if (task) {
			lines.push({ key, kind: "task", level: 0, text: task[2], done: task[1] !== " " })
		} else if (bullet) {
			lines.push({ key, kind: "bullet", level: 0, text: bullet[1], done: false })
		} else {
			lines.push({ key, kind: "text", level: 0, text: line, done: false })
		}
	}
	return lines
}

function parsePreview(content: string) {
	try {
		const { meta, body } = parseFrontmatter(content)
		return { properties: Object.entries(meta), lines: parseLines(body) }
	} catch {
		return { properties: [], lines: parseLines(content) }
	}
}

export function TemplateNotePreview({ content, title, className }: TemplateNotePreviewProps) {
	const { properties, lines } = useMemo(() => parsePreview(content), [content])
	return (
		<div className={cn("template-note-preview", className)}>
			{title !== undefined ? <h2 className="template-note-preview-title">{title}</h2> : null}
			{properties.length > 0 ? (
				<dl className="template-note-preview-props">
					{properties.map(([key, value]) => {
						const text = formatValue(value)
						return (
							<div key={key} className="template-note-preview-prop">
								<dt>{key}</dt>
								<dd data-empty={text ? undefined : "true"}>{text || "Empty"}</dd>
							</div>
						)
					})}
				</dl>
			) : null}
			<div className="template-note-preview-body">
				{lines.map((line) => {
					if (line.kind === "heading") {
						return (
							<div key={line.key} className="template-note-preview-heading" data-level={line.level}>
								{line.text}
							</div>
						)
					}
					if (line.kind === "task") {
						return (
							<div key={line.key} className="template-note-preview-task" data-done={line.done}>
								<span className="template-note-preview-check" aria-hidden="true" />
								<span>{line.text}</span>
							</div>
						)
					}
					return (
						<div key={line.key} className="template-note-preview-line" data-kind={line.kind}>
							{line.text}
						</div>
					)
				})}
			</div>
		</div>
	)
}
