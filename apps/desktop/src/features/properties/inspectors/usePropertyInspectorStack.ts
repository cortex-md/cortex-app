import { useState } from "react"
import type { PropertyInspectorPanel } from "../types"

export function usePropertyInspectorStack() {
	const [panels, setPanels] = useState<PropertyInspectorPanel[]>([{ kind: "value" }])
	const currentPanel = panels[panels.length - 1]
	const openPanel = (panel: PropertyInspectorPanel) => setPanels([panel])
	const pushPanel = (panel: PropertyInspectorPanel) => setPanels((current) => [...current, panel])
	const popPanel = () =>
		setPanels((current) => (current.length > 1 ? current.slice(0, -1) : current))
	const resetPanels = () => setPanels([{ kind: "value" }])

	return {
		currentPanel,
		openPanel,
		panelCount: panels.length,
		popPanel,
		pushPanel,
		resetPanels,
	}
}
