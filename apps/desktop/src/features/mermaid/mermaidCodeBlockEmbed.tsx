import type { CodeBlockEmbedDefinition } from "@cortex/editor/code-block-embeds"
import { MermaidEmbedCard } from "./MermaidEmbedCard"
import { mountMermaidLivePreview } from "./MermaidLivePreview"
import { createMermaidDiagramReference, MERMAID_FENCE_LANGUAGE } from "./mermaidDocument"
import { openMermaidModal } from "./mermaidModalStore"

export function createMermaidCodeBlockEmbed(filePath: string): CodeBlockEmbedDefinition {
	return {
		languages: [MERMAID_FENCE_LANGUAGE],
		render: ({ block }) => <MermaidEmbedCard filePath={filePath} block={block} />,
		renderLivePreview: ({ block }) => {
			const reference = createMermaidDiagramReference(filePath, block)
			if (!reference.source.trim()) {
				return {
					title: "Mermaid diagram unavailable",
					description: "The diagram block is empty.",
					icon: "!",
					tone: "error",
					signature: reference.sourceHash,
				}
			}
			return {
				title: reference.title,
				className: "is-mermaid-diagram",
				signature: reference.sourceHash,
				mount: (container) => mountMermaidLivePreview(container, reference),
			}
		},
		canOpenLivePreview: ({ content }) => content.trim().length > 0,
		openLivePreview: ({ block }) => {
			const reference = createMermaidDiagramReference(filePath, block)
			if (reference.source.trim()) openMermaidModal(reference)
		},
		livePreviewOpenLabel: "Open",
	}
}
