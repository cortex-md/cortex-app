import { getThemeManager } from "@cortex/theme"
import { useEffect, useState, useSyncExternalStore } from "react"
import {
	getMermaidThemeSignature,
	type MermaidRenderState,
	renderMermaidDiagram,
} from "./mermaidRenderer"

type MermaidDiagramState =
	| { status: "loading" }
	| { status: "success"; svg: string }
	| { status: "error"; message: string }

function subscribeMermaidTheme(listener: () => void): () => void {
	const unsubscribeTheme = getThemeManager().subscribe(listener)
	const observer =
		typeof document === "undefined" || typeof MutationObserver === "undefined"
			? null
			: new MutationObserver(listener)

	observer?.observe(document.body, {
		attributes: true,
		attributeFilter: ["data-theme-scheme", "data-color-scheme", "style", "class"],
	})

	return () => {
		unsubscribeTheme()
		observer?.disconnect()
	}
}

function toDiagramState(result: MermaidRenderState): MermaidDiagramState {
	return result.status === "success"
		? { status: "success", svg: result.svg }
		: { status: "error", message: result.message }
}

export function useMermaidDiagram(source: string): MermaidDiagramState {
	const themeSignature = useSyncExternalStore(
		subscribeMermaidTheme,
		getMermaidThemeSignature,
		getMermaidThemeSignature,
	)
	const [state, setState] = useState<MermaidDiagramState>({ status: "loading" })

	useEffect(() => {
		let cancelled = false
		const requestedThemeSignature = themeSignature
		setState({ status: "loading" })
		renderMermaidDiagram(source).then((result) => {
			if (!cancelled && result.themeSignature === requestedThemeSignature) {
				setState(toDiagramState(result))
			}
		})
		return () => {
			cancelled = true
		}
	}, [source, themeSignature])

	return state
}
