import { embedModal, openEmbedViewTab } from "../embeds/embeds"
import { DrawingBoard } from "./DrawingBoard"
import { DRAWING_BOARD_VIEW_ID } from "./drawingDocument"

export interface DrawingTarget {
	filePath: string
	drawingId: string
}

export function openDrawingBoardTab(filePath: string, drawingId: string, title = "Drawing"): void {
	openEmbedViewTab(DRAWING_BOARD_VIEW_ID, title, { filePath, drawingId })
}

export function openDrawingModal({ filePath, drawingId }: DrawingTarget): void {
	embedModal.open({
		kind: "drawing",
		title: "Drawing",
		body: <DrawingBoard filePath={filePath} drawingId={drawingId} />,
		openInTab: () => openDrawingBoardTab(filePath, drawingId),
	})
}
