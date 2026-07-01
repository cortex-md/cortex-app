import { DATABASE_VIEW_ID } from "@cortex/core"
import type { CoreViewProps } from "../split-view/coreViewRegistry"
import { DatabaseEmbedSurface } from "./DatabaseEmbedSurface"
import { isDatabaseViewTabState } from "./databaseWorkspace"

export function DatabaseView({ viewState, onStateChange }: CoreViewProps) {
	if (!isDatabaseViewTabState(viewState)) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-text-muted">
				Database view not available
			</div>
		)
	}

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-bg-primary"
			data-core-view-id={DATABASE_VIEW_ID}
		>
			<DatabaseEmbedSurface
				databaseId={viewState.databaseId}
				viewId={viewState.viewId}
				embedded={false}
				onViewChange={(viewId) => onStateChange?.({ ...viewState, viewId })}
			/>
		</div>
	)
}

export { DATABASE_VIEW_ID }
