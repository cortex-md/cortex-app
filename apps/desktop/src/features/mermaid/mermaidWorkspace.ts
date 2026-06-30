import { useWorkspaceStore } from "@cortex/core"
import {
	createMermaidDiagramViewState,
	MERMAID_DIAGRAM_VIEW_ID,
	type MermaidDiagramReference,
} from "./mermaidDocument"

export function openMermaidDiagramTab(reference: MermaidDiagramReference): void {
	useWorkspaceStore.getState().openViewTab(MERMAID_DIAGRAM_VIEW_ID, reference.title, {
		forceNew: true,
		ephemeral: true,
		viewState: createMermaidDiagramViewState(reference),
	})
}
