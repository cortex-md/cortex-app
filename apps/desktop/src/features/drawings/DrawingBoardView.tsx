import type { CoreViewProps } from "../split-view/coreViewRegistry"
import { DrawingBoard } from "./DrawingBoard"
import type { DrawingBoardViewState } from "./drawingDocument"

function readDrawingBoardViewState(value: unknown): DrawingBoardViewState | null {
	if (!value || typeof value !== "object") return null
	const state = value as Record<string, unknown>
	return typeof state.filePath === "string" && typeof state.drawingId === "string"
		? { filePath: state.filePath, drawingId: state.drawingId }
		: null
}

export function DrawingBoardView({ viewState }: CoreViewProps) {
	const state = readDrawingBoardViewState(viewState)

	if (!state) {
		return (
			<div className="drawing-board-state">
				<p>Drawing tab state is unavailable.</p>
			</div>
		)
	}

	return (
		<div className="drawing-board-view">
			<DrawingBoard filePath={state.filePath} drawingId={state.drawingId} />
		</div>
	)
}
