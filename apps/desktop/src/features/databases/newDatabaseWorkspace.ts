import { useVaultStore, useWorkspaceStore } from "@cortex/core"
import type { DatabasePreset } from "@cortex/properties/database"

export const NEW_DATABASE_VIEW_ID = "new-database"

export interface NewDatabaseViewState {
	parentPath: string | null
	mode: "create" | "convert"
	presetKey: string | null
	preset: DatabasePreset | null
	token: string
}

export function readNewDatabaseViewState(viewState: Record<string, unknown>): NewDatabaseViewState {
	return {
		parentPath: typeof viewState.parentPath === "string" ? viewState.parentPath : null,
		mode: viewState.mode === "convert" ? "convert" : "create",
		presetKey: typeof viewState.presetKey === "string" ? viewState.presetKey : null,
		preset:
			viewState.preset && typeof viewState.preset === "object"
				? (viewState.preset as DatabasePreset)
				: null,
		token: typeof viewState.token === "string" ? viewState.token : "",
	}
}

export function closeNewDatabaseTab(token: string): void {
	const workspace = useWorkspaceStore.getState()
	for (const [paneId, pane] of Object.entries(workspace.panes)) {
		const tab = pane.tabs.find(
			(item) => item.viewId === NEW_DATABASE_VIEW_ID && item.viewState?.token === token,
		)
		if (tab) {
			workspace.closeTab(tab.id, paneId)
			return
		}
	}
}

export function openNewDatabaseView(options: Partial<NewDatabaseViewState> = {}): void {
	if (!useVaultStore.getState().vault) return
	const viewState: Record<string, unknown> = {
		parentPath: options.parentPath ?? null,
		mode: options.mode ?? "create",
		presetKey: options.presetKey ?? options.preset?.id ?? null,
		...(options.preset ? { preset: options.preset } : {}),
		token: crypto.randomUUID(),
	}
	useWorkspaceStore.getState().openViewTab(NEW_DATABASE_VIEW_ID, "New database", {
		viewState,
		forceNew: true,
	})
}
