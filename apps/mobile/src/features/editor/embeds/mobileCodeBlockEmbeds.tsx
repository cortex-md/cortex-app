import type {
	CodeBlockEmbedDefinition,
	CodeBlockEmbedLivePreview,
} from "@cortex/editor/code-block-embeds"
import { hashMermaidSource, renderMermaidDiagram } from "@cortex/editor/mermaid"
import { useEffect, useRef } from "react"

const MERMAID_LANGUAGE = "mermaid"
const DRAWING_LANGUAGE = "cortex-draw"
const THEME_ROOT_SELECTOR = ".mobile-code-mirror-root"

function mountMermaid(container: HTMLElement, source: string): () => void {
	let active = true
	container.classList.add("mobile-mermaid")
	container.textContent = "Rendering diagram…"
	const themeRoot = container.closest<HTMLElement>(THEME_ROOT_SELECTOR) ?? undefined
	void renderMermaidDiagram(source, themeRoot).then((result) => {
		if (!active) return
		if (result.status === "success") {
			container.innerHTML = result.svg
			container.removeAttribute("data-error")
		} else {
			container.textContent = result.message
			container.setAttribute("data-error", "true")
		}
	})
	return () => {
		active = false
		container.replaceChildren()
	}
}

function MermaidBlock({ source }: { source: string }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const container = ref.current
		if (!container) return
		return mountMermaid(container, source)
	}, [source])
	return <div className="mobile-mermaid" ref={ref} />
}

function countDrawingElements(content: string): number | null {
	try {
		const parsed = JSON.parse(content) as { scene?: { elements?: unknown[] } }
		const elements = parsed.scene?.elements
		return Array.isArray(elements) ? elements.length : null
	} catch {
		return null
	}
}

function drawingPreview(content: string): CodeBlockEmbedLivePreview {
	const count = countDrawingElements(content)
	if (count === null) {
		return {
			title: "Drawing unavailable",
			description: "The drawing data could not be read.",
			icon: "!",
			tone: "error",
			signature: `drawing-error-${content.length}`,
		}
	}
	return {
		title: "Drawing",
		description: "Open on desktop to edit",
		meta: `${count} ${count === 1 ? "shape" : "shapes"}`,
		icon: "Draw",
		signature: `drawing-${count}-${content.length}`,
	}
}

export const MOBILE_CODE_BLOCK_EMBEDS: readonly CodeBlockEmbedDefinition[] = [
	{
		languages: [MERMAID_LANGUAGE],
		render: ({ content }) => <MermaidBlock source={content} />,
		renderLivePreview: ({ content }) => {
			if (!content.trim()) {
				return {
					title: "Mermaid diagram unavailable",
					description: "The diagram block is empty.",
					icon: "!",
					tone: "error",
					signature: "mermaid-empty",
				}
			}
			return {
				title: "Mermaid diagram",
				className: "is-mermaid-diagram",
				signature: hashMermaidSource(content),
				mount: (container) => mountMermaid(container, content),
			}
		},
	},
	{
		languages: [DRAWING_LANGUAGE],
		render: ({ content }) => {
			const preview = drawingPreview(content)
			return (
				<div className="mobile-drawing-card">
					<strong>{preview.title}</strong>
					<span>{[preview.description, preview.meta].filter(Boolean).join(" · ")}</span>
				</div>
			)
		},
		renderLivePreview: ({ content }) => drawingPreview(content),
	},
]
