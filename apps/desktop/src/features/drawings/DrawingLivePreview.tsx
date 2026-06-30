import { createRoot, type Root } from "react-dom/client"
import { createDeferredRootUnmount } from "../../utils/reactRoot"
import { DrawingBoard } from "./DrawingBoard"

interface DrawingLivePreviewProps {
	filePath: string
	drawingId: string
}

function DrawingLivePreviewBoard({ filePath, drawingId }: DrawingLivePreviewProps) {
	return (
		<div className="drawing-live-preview-board">
			<DrawingBoard filePath={filePath} drawingId={drawingId} />
		</div>
	)
}

export function mountDrawingLivePreview(
	container: HTMLElement,
	props: DrawingLivePreviewProps,
): () => void {
	const root: Root = createRoot(container)
	root.render(<DrawingLivePreviewBoard {...props} />)
	return createDeferredRootUnmount(root)
}
