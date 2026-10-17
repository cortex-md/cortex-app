import type { Dispatch } from "react"

export interface SidebarUiState {
	expandedFolders: ReadonlySet<string>
}

export type SidebarUiAction =
	| { type: "set-expanded-folders"; folders: ReadonlySet<string> }
	| { type: "toggle-folder"; path: string }

export interface SidebarUi {
	closeSidebar: () => void
	dispatchUi: Dispatch<SidebarUiAction>
	uiState: SidebarUiState
}

export const initialSidebarUiState: SidebarUiState = {
	expandedFolders: new Set(),
}

export function sidebarUiReducer(state: SidebarUiState, action: SidebarUiAction): SidebarUiState {
	switch (action.type) {
		case "set-expanded-folders":
			return { ...state, expandedFolders: action.folders }
		case "toggle-folder": {
			const expandedFolders = new Set(state.expandedFolders)
			if (expandedFolders.has(action.path)) expandedFolders.delete(action.path)
			else expandedFolders.add(action.path)
			return { ...state, expandedFolders }
		}
	}
}
