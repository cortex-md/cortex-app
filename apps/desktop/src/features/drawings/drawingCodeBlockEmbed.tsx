import type { CodeBlockEmbedDefinition } from "@cortex/editor/code-block-embeds"
import { mountEmbedPortal } from "../embeds/embeds"
import { DrawingBoard } from "./DrawingBoard"
import { DrawingEmbedCard } from "./DrawingEmbedCard"
import { DRAWING_FENCE_LANGUAGE, parseDrawingDocument } from "./drawingDocument"
import { openDrawingModal } from "./drawingWorkspace"

export function createDrawingCodeBlockEmbed(filePath: string): CodeBlockEmbedDefinition {
	return {
		languages: [DRAWING_FENCE_LANGUAGE],
		render: ({ block }) => <DrawingEmbedCard filePath={filePath} block={block} />,
		renderLivePreview: ({ content }) => {
			const document = parseDrawingDocument(content)
			if (!document) {
				return {
					title: "Drawing unavailable",
					description: "The embedded drawing data could not be read.",
					icon: "!",
					tone: "error",
				}
			}
			return {
				title: document.title,
				className: "is-drawing-board",
				mount: (container) =>
					mountEmbedPortal(
						container,
						<div className="drawing-live-preview-board">
							<DrawingBoard filePath={filePath} drawingId={document.id} />
						</div>,
					),
			}
		},
		canOpenLivePreview: ({ content }) => parseDrawingDocument(content) !== null,
		openLivePreview: ({ content }) => {
			const document = parseDrawingDocument(content)
			if (document) openDrawingModal({ filePath, drawingId: document.id })
		},
		livePreviewOpenLabel: "Open",
	}
}
