import type { ParsedCodeBlockEmbed } from "@cortex/editor/code-block-embeds"
import { Button } from "@cortex/ui"
import { GitBranchIcon, Maximize2Icon, PanelTopOpenIcon } from "lucide-react"
import { MermaidDiagramSurface } from "./MermaidDiagramSurface"
import { createMermaidDiagramReference } from "./mermaidDocument"
import { openMermaidModal } from "./mermaidModalStore"
import { openMermaidDiagramTab } from "./mermaidWorkspace"

interface MermaidEmbedCardProps {
	filePath: string
	block: ParsedCodeBlockEmbed
}

export function MermaidEmbedCard({ filePath, block }: MermaidEmbedCardProps) {
	const reference = createMermaidDiagramReference(filePath, block)
	const hasSource = reference.source.trim().length > 0

	const handleOpenModal = () => {
		if (hasSource) openMermaidModal(reference)
	}

	const handleOpenTab = () => {
		if (hasSource) openMermaidDiagramTab(reference)
	}

	return (
		<div className="mermaid-embed-card">
			<div className="mermaid-embed-header">
				<div className="mermaid-embed-icon" aria-hidden="true">
					<GitBranchIcon className="size-4" />
				</div>
				<div className="mermaid-embed-copy">
					<div className="mermaid-embed-title">{reference.title}</div>
					<div className="mermaid-embed-meta">Mermaid diagram</div>
				</div>
				{hasSource && (
					<div className="mermaid-embed-actions">
						<Button type="button" variant="outline" size="sm" onClick={handleOpenModal}>
							<Maximize2Icon className="size-3.5" aria-hidden="true" />
							Open
						</Button>
						<Button type="button" variant="ghost" size="sm" onClick={handleOpenTab}>
							<PanelTopOpenIcon className="size-3.5" aria-hidden="true" />
							Tab
						</Button>
					</div>
				)}
			</div>
			<MermaidDiagramSurface
				source={reference.source}
				title={reference.title}
				className="is-embed"
				onOpen={hasSource ? handleOpenModal : undefined}
			/>
		</div>
	)
}
