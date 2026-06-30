import type { ParsedCodeBlockEmbed } from "@cortex/editor/code-block-embeds"
import { Button } from "@cortex/ui"
import { Maximize2Icon, PanelTopOpenIcon, PenLineIcon, TriangleAlertIcon } from "lucide-react"
import { parseDrawingDocument } from "./drawingDocument"
import { openDrawingModal } from "./drawingModalStore"
import { openDrawingBoardTab } from "./drawingWorkspace"

interface DrawingEmbedCardProps {
	filePath: string
	block: ParsedCodeBlockEmbed
}

export function formatDrawingUpdatedAt(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return "Not saved yet"
	return `Updated ${date.toLocaleString()}`
}

export function DrawingEmbedCard({ filePath, block }: DrawingEmbedCardProps) {
	const document = parseDrawingDocument(block.content)

	if (!document) {
		return (
			<div className="drawing-embed-card is-error">
				<div className="drawing-embed-icon" aria-hidden="true">
					<TriangleAlertIcon className="size-4" />
				</div>
				<div className="drawing-embed-copy">
					<div className="drawing-embed-title">Drawing unavailable</div>
					<div className="drawing-embed-meta">The embedded drawing data could not be read.</div>
				</div>
			</div>
		)
	}

	const handleOpenModal = () => {
		openDrawingModal({ filePath, drawingId: document.id })
	}
	const handleOpenTab = () => {
		openDrawingBoardTab(filePath, document.id, document.title)
	}

	return (
		<div className="drawing-embed-card">
			<div className="drawing-embed-icon" aria-hidden="true">
				<PenLineIcon className="size-4" />
			</div>
			<div className="drawing-embed-copy">
				<div className="drawing-embed-title">{document.title}</div>
				<div className="drawing-embed-meta">{formatDrawingUpdatedAt(document.updatedAt)}</div>
			</div>
			<div className="drawing-embed-actions">
				<Button type="button" variant="outline" size="sm" onClick={handleOpenModal}>
					<Maximize2Icon className="size-3.5" aria-hidden="true" />
					Open
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={handleOpenTab}>
					<PanelTopOpenIcon className="size-3.5" aria-hidden="true" />
					Tab
				</Button>
			</div>
		</div>
	)
}
