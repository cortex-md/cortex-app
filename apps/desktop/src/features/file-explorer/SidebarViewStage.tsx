import type { ComponentType } from "react"
import { Activity, useEffect, useState } from "react"
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
	visitedIds: readonly string[]
}

interface SidebarViewStageProps {
	activeId: string
	items: SidebarViewItem[]
	ViewComponent: ComponentType<SidebarViewPanelProps>
}

const SIDEBAR_VIEW_TRANSITION_MS = 220

function clearPreviousPanel(revision: number) {
	return (transition: SidebarViewTransition): SidebarViewTransition =>
		transition.revision === revision && transition.previousId
			? { ...transition, previousId: null }
			: transition
}

function getPanelClassName(isCurrent: boolean, isPrevious: boolean, animated: boolean): string {
	if (isCurrent) {
		return `sidebar-view-panel sidebar-view-panel--current${animated ? " sidebar-view-panel--animated" : ""}`
	}
	return isPrevious ? "sidebar-view-panel sidebar-view-panel--previous" : "sidebar-view-panel"
}

export function SidebarViewStage({ activeId, items, ViewComponent }: SidebarViewStageProps) {
	const [transition, setTransition] = useState<SidebarViewTransition>(() => ({
		currentId: activeId,
		previousId: null,
		direction: "forward",
		revision: 0,
		visitedIds: [activeId],
	}))

	if (transition.currentId !== activeId) {
		setTransition({
			currentId: activeId,
			previousId: transition.currentId,
			direction: getSidebarViewDirection(items, transition.currentId, activeId),
			revision: transition.revision + 1,
			visitedIds: transition.visitedIds.includes(activeId)
				? transition.visitedIds
				: [...transition.visitedIds, activeId],
		})
	}

	useEffect(() => {
		if (!transition.previousId) return
		const transitionDuration =
			document.body.dataset.reducedMotion === "true" ? 0 : SIDEBAR_VIEW_TRANSITION_MS
		const cleanupTimer = window.setTimeout(
			() => setTransition(clearPreviousPanel(transition.revision)),
			transitionDuration,
		)
		return () => window.clearTimeout(cleanupTimer)
	}, [transition.previousId, transition.revision])

	const availableIds = new Set(items.map((item) => item.id))
	const animated = transition.previousId !== null

	return (
		<div className="sidebar-view-stage">
			{transition.visitedIds.map((id) => {
				if (id !== transition.currentId && !availableIds.has(id)) return null
				const isCurrent = id === transition.currentId
				const isPrevious = id === transition.previousId
				return (
					<Activity key={id} mode={isCurrent || isPrevious ? "visible" : "hidden"}>
						<div
							id={isCurrent ? "sidebar-view-panel" : undefined}
							role="tabpanel"
							aria-labelledby={`sidebar-view-tab-${id}`}
							aria-hidden={isCurrent ? undefined : true}
							inert={!isCurrent}
							className={getPanelClassName(isCurrent, isPrevious, animated)}
							data-direction={transition.direction}
							onAnimationEnd={(event) => {
								if (isCurrent && event.target === event.currentTarget) {
									setTransition(clearPreviousPanel(transition.revision))
								}
							}}
						>
							<ViewComponent id={id} />
						</div>
					</Activity>
				)
			})}
		</div>
	)
}
