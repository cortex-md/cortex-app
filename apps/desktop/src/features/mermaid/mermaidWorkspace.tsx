import { embedModal, openEmbedViewTab } from "../embeds/embeds"
import { MermaidDiagramExplorer } from "./MermaidDiagramExplorer"
import {
	createMermaidDiagramViewState,
	MERMAID_DIAGRAM_VIEW_ID,
	type MermaidDiagramReference,
} from "./mermaidDocument"

export function openMermaidDiagramTab(reference: MermaidDiagramReference): void {
	openEmbedViewTab(
		MERMAID_DIAGRAM_VIEW_ID,
		reference.title,
		createMermaidDiagramViewState(reference),
	)
}

export function openMermaidModal(reference: MermaidDiagramReference): void {
	embedModal.open({
		kind: "mermaid",
		title: reference.title,
		body: <MermaidDiagramExplorer source={reference.source} title={reference.title} />,
		openInTab: () => openMermaidDiagramTab(reference),
	})
}
