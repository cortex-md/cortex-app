import { Button } from "@cortex/ui"
import { TriangleAlertIcon } from "lucide-react"
import { useMermaidDiagram } from "./useMermaidDiagram"

interface MermaidDiagramSurfaceProps {
	source: string
	title: string
	className?: string
	onOpen?: () => void
}

function MermaidDiagramSurfaceContent({ source }: Pick<MermaidDiagramSurfaceProps, "source">) {
	const diagram = useMermaidDiagram(source)

	if (diagram.status === "loading") {
		return <div className="mermaid-diagram-state">Rendering diagram...</div>
	}

	if (diagram.status === "error") {
		return (
			<div className="mermaid-diagram-state is-error">
				<TriangleAlertIcon className="size-4" aria-hidden="true" />
				<span>{diagram.message}</span>
			</div>
		)
	}

	return (
		<div
			className="mermaid-diagram-svg"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid SVG is sanitized and namespaced before reaching this sink
			dangerouslySetInnerHTML={{ __html: diagram.svg }}
		/>
	)
}

export function MermaidDiagramSurface({
	source,
	title,
	className = "",
	onOpen,
}: MermaidDiagramSurfaceProps) {
	const surfaceClassName = `mermaid-diagram-surface${className ? ` ${className}` : ""}`

	if (onOpen) {
		return (
			<Button
				size="sm"
				variant="ghost"
				className={`${surfaceClassName} h-auto whitespace-normal active:scale-100`}
				onClick={onOpen}
				aria-label={`Open ${title}`}
			>
				<MermaidDiagramSurfaceContent source={source} />
			</Button>
		)
	}

	return (
		<div className={surfaceClassName} role="img" aria-label={title}>
			<MermaidDiagramSurfaceContent source={source} />
		</div>
	)
}
