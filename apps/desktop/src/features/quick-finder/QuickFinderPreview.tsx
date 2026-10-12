import { noteCache } from "@cortex/core"
import { ReadingView } from "@cortex/editor/reading-view"
import { projectRawNote } from "@cortex/properties"
import { useEffect, useState } from "react"
import { getSidebarNotePresentation } from "../sidebar/sidebarNotePresentation"

const PREVIEW_BODY_LIMIT = 2000

interface QuickFinderPreviewProps {
	filePath: string
	vaultPath: string
}

interface PreviewContent {
	filePath: string
	body: string
	tags: string[]
}

function toTags(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : []
}

export function QuickFinderPreview({ filePath, vaultPath }: QuickFinderPreviewProps) {
	const [content, setContent] = useState<PreviewContent | null>(null)
	const notePath = getSidebarNotePresentation(filePath, vaultPath)
	const folder = notePath.folder

	useEffect(() => {
		let cancelled = false
		void noteCache
			.read(filePath)
			.then((raw) => {
				if (cancelled) return
				const projection = projectRawNote(raw)
				setContent({
					filePath,
					body: projection.body.slice(0, PREVIEW_BODY_LIMIT),
					tags: toTags(projection.meta.tags),
				})
			})
			.catch(() => {
				if (!cancelled) setContent({ filePath, body: "", tags: [] })
			})
		return () => {
			cancelled = true
		}
	}, [filePath])

	const current = content?.filePath === filePath ? content : null

	return (
		<section className="quick-finder-preview" aria-label="Preview">
			{folder && <div className="quick-finder-preview-path">{folder}</div>}
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
			{current?.body && (
				<div className="quick-finder-preview-body">
					<ReadingView content={current.body} />
				</div>
			)}
		</section>
	)
}
