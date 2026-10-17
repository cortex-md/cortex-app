import { formatRelativeTime, noteCache } from "@cortex/core"
import { projectRawNote } from "@cortex/properties"
import { stripMarkdown } from "@cortex/search"
import { useEffect, useState } from "react"
import { useMinuteNow } from "@/hooks/useMinuteNow"
import { getSidebarNotePresentation } from "../sidebar/sidebarNotePresentation"
import { formatFolderLabel } from "./quickFinderText"

const PREVIEW_BODY_LIMIT = 1500

interface QuickFinderPreviewProps {
	filePath: string
	vaultPath: string
	modifiedAt: number | undefined
}

interface PreviewParagraph {
	key: string
	text: string
}

interface PreviewContent {
	filePath: string
	paragraphs: PreviewParagraph[]
	tags: string[]
}

function toTags(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : []
}

function toParagraphs(body: string): PreviewParagraph[] {
	const seen = new Map<string, number>()
	return stripMarkdown(body.slice(0, PREVIEW_BODY_LIMIT * 2))
		.slice(0, PREVIEW_BODY_LIMIT)
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.map((text) => {
			const count = (seen.get(text) ?? 0) + 1
			seen.set(text, count)
			return { key: `${count}:${text.slice(0, 32)}`, text }
		})
}

export function QuickFinderPreview({ filePath, vaultPath, modifiedAt }: QuickFinderPreviewProps) {
	const [content, setContent] = useState<PreviewContent | null>(null)
	const now = useMinuteNow()
	const notePath = getSidebarNotePresentation(filePath, vaultPath)
	const edited = formatRelativeTime(modifiedAt, "long", now)
	const crumb = [formatFolderLabel(notePath.folder), edited && `edited ${edited}`]
		.filter(Boolean)
		.join(" · ")

	useEffect(() => {
		let cancelled = false
		void noteCache
			.read(filePath)
			.then((raw) => {
				if (cancelled) return
				const projection = projectRawNote(raw)
				setContent({
					filePath,
					paragraphs: toParagraphs(projection.body),
					tags: toTags(projection.meta.tags),
				})
			})
			.catch(() => {
				if (!cancelled) setContent({ filePath, paragraphs: [], tags: [] })
			})
		return () => {
			cancelled = true
		}
	}, [filePath])

	const current = content?.filePath === filePath ? content : null

	return (
		<section className="quick-finder-preview" aria-label="Preview">
			{crumb && <div className="quick-finder-preview-path">{crumb}</div>}
			<h2>{notePath.title}</h2>
			{current && current.tags.length > 0 && (
				<div className="quick-finder-preview-tags">
					{current.tags.map((tag) => (
						<span key={tag} className="note-property-tag-chip">
							#{tag}
						</span>
					))}
				</div>
			)}
			{current && current.paragraphs.length > 0 && (
				<div className="quick-finder-preview-body">
					{current.paragraphs.map((paragraph) => (
						<p key={paragraph.key}>{paragraph.text}</p>
					))}
				</div>
			)}
		</section>
	)
}
