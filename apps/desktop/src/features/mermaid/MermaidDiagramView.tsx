import { noteCache } from "@cortex/core"
import { useEffect, useMemo, useState } from "react"
import type { CoreViewProps } from "../split-view/coreViewRegistry"
import { MermaidDiagramExplorer } from "./MermaidDiagramExplorer"
import {
	type MermaidDiagramReference,
	readMermaidDiagramFromNote,
	readMermaidDiagramViewState,
} from "./mermaidDocument"

type ResolvedDiagram = MermaidDiagramReference | null | undefined

export function MermaidDiagramView({ viewState, isActive }: CoreViewProps) {
	const state = useMemo(() => readMermaidDiagramViewState(viewState), [viewState])
	const [diagram, setDiagram] = useState<ResolvedDiagram>(undefined)

	useEffect(() => {
		if (!state) {
			setDiagram(null)
			return
		}

		let active = true
		const refreshDiagram = async () => {
			try {
				const nextDiagram = await readMermaidDiagramFromNote(state)
				if (active) setDiagram(nextDiagram)
			} catch (_error) {
				if (active) setDiagram(null)
			}
		}

		setDiagram(undefined)
		void refreshDiagram()
		const unsubscribe = noteCache.onContentChange(state.filePath, () => {
			void refreshDiagram()
		})

		return () => {
			active = false
			unsubscribe()
		}
	}, [state])

	if (!state) {
		return (
			<div className="mermaid-diagram-view-state">
				<p>Mermaid tab state is unavailable.</p>
			</div>
		)
	}

	if (diagram === undefined) {
		return (
			<div className="mermaid-diagram-view-state">
				<p>Loading diagram...</p>
			</div>
		)
	}

	if (!diagram) {
		return (
			<div className="mermaid-diagram-view-state">
				<p>Diagram not found.</p>
			</div>
		)
	}

	return (
		<div className="mermaid-diagram-view">
			<MermaidDiagramExplorer source={diagram.source} title={diagram.title} isActive={isActive} />
		</div>
	)
}
