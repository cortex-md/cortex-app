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
			<button
				type="button"
				className={surfaceClassName}
				onClick={onOpen}
				aria-label={`Open ${title}`}
			>
				<MermaidDiagramSurfaceContent source={source} />
			</button>
		)
	}

	return (
		<div className={surfaceClassName} title={title}>
			<MermaidDiagramSurfaceContent source={source} />
		</div>
	)
}
