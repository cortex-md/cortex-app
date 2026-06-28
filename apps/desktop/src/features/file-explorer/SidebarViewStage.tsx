import type { ComponentType } from "react"
import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import {
	getSidebarViewDirection,
	type SidebarViewItem,
	type SidebarViewPanelProps,
} from "./sidebarViewUtils"

interface SidebarViewTransition {
	currentId: string
	previousId: string | null
	direction: "backward" | "forward"
	revision: number
}

interface SidebarViewStageProps {
	activeId: string
	items: SidebarViewItem[]
	ViewComponent: ComponentType<SidebarViewPanelProps>
}

export function SidebarViewStage({ activeId, items, ViewComponent }: SidebarViewStageProps) {
	const [transition, setTransition] = useState<SidebarViewTransition>({
		currentId: activeId,
		previousId: null,
		direction: "forward",
		revision: 0,
	})

	useLayoutEffect(() => {
		setTransition((currentTransition) => {
			if (currentTransition.currentId === activeId) return currentTransition
			return {
				currentId: activeId,
				previousId: currentTransition.currentId,
				direction: getSidebarViewDirection(items, currentTransition.currentId, activeId),
				revision: currentTransition.revision + 1,
			}
		})
	}, [activeId, items])

	const finishTransition = useCallback((revision: number) => {
		setTransition((currentTransition) =>
			currentTransition.revision === revision
				? { ...currentTransition, previousId: null }
				: currentTransition,
		)
	}, [])

	useEffect(() => {
		if (!transition.previousId) return
		const transitionDuration = document.body.dataset.reducedMotion === "true" ? 0 : 220
		const cleanupTimer = window.setTimeout(
			() => finishTransition(transition.revision),
			transitionDuration,
		)
		return () => window.clearTimeout(cleanupTimer)
	}, [finishTransition, transition.previousId, transition.revision])

	return (
		<div className="sidebar-view-stage">
			{transition.previousId && (
				<div
					key={`previous-${transition.revision}-${transition.previousId}`}
					className="sidebar-view-panel sidebar-view-panel--previous"
					data-direction={transition.direction}
					aria-hidden="true"
				>
					<ViewComponent id={transition.previousId} />
				</div>
			)}
			<div
				key={`current-${transition.revision}-${transition.currentId}`}
				id="sidebar-view-panel"
				role="tabpanel"
				aria-labelledby={`sidebar-view-tab-${transition.currentId}`}
				className={`sidebar-view-panel sidebar-view-panel--current ${
					transition.previousId ? "sidebar-view-panel--animated" : ""
				}`}
				data-direction={transition.direction}
				onAnimationEnd={() => finishTransition(transition.revision)}
			>
				<ViewComponent id={transition.currentId} />
			</div>
		</div>
	)
}
