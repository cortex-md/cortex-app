import { createRoot, type Root } from "react-dom/client"
import { createDeferredRootUnmount } from "../../utils/reactRoot"
import { MermaidDiagramSurface } from "./MermaidDiagramSurface"
import type { MermaidDiagramReference } from "./mermaidDocument"
import { openMermaidModal } from "./mermaidModalStore"

function MermaidLivePreviewDiagram(reference: MermaidDiagramReference) {
	const handleOpen = () => {
		openMermaidModal(reference)
	}

	return (
		<div className="mermaid-live-preview">
			<MermaidDiagramSurface
				source={reference.source}
				title={reference.title}
				className="is-live-preview"
				onOpen={handleOpen}
			/>
		</div>
	)
}

export function mountMermaidLivePreview(
	container: HTMLElement,
	reference: MermaidDiagramReference,
): () => void {
	const root: Root = createRoot(container)
	root.render(<MermaidLivePreviewDiagram {...reference} />)
	return createDeferredRootUnmount(root)
}
