import { useWorkspaceStore } from "@cortex/core"
import { DRAWING_BOARD_VIEW_ID } from "./drawingDocument"

export function openDrawingBoardTab(filePath: string, drawingId: string, title = "Drawing"): void {
	useWorkspaceStore.getState().openViewTab(DRAWING_BOARD_VIEW_ID, title, {
		forceNew: true,
		ephemeral: true,
		viewState: { filePath, drawingId },
	})
}
