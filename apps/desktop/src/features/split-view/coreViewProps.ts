import type { ViewTabState } from "@cortex/core"

export interface CoreViewProps {
	viewState: ViewTabState
	onStateChange: (viewState: ViewTabState) => void
	isActive: boolean
}
