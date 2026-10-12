import type { FileEntry } from "@cortex/platform"
import type { Dispatch } from "react"

import type { PendingVaultFolder } from "@/features/onboarding/OnboardingScreen"

export type TextSheetAction =
	| { kind: "create-note"; parentPath: string }
	| { kind: "create-folder"; parentPath: string }
	| { kind: "rename"; entry: FileEntry }
	| null

export interface SidebarUiState {
	entryActionsEntry: FileEntry | null
	expandedFolders: ReadonlySet<string>
	morePresented: boolean
	moveEntry: FileEntry | null
	moveError: string | null
	pendingVaultFolder: PendingVaultFolder | null
	submitting: boolean
	switcherPresented: boolean
	textAction: TextSheetAction
	textError: string | null
}

export type SidebarUiAction =
	| { type: "set-entry-actions-entry"; entry: FileEntry | null }
	| { type: "set-expanded-folders"; folders: ReadonlySet<string> }
	| { type: "set-more-presented"; presented: boolean }
	| { type: "set-move-entry"; entry: FileEntry | null }
	| { type: "set-move-error"; error: string | null }
	| { type: "set-pending-vault-folder"; folder: PendingVaultFolder | null }
	| { type: "set-submitting"; submitting: boolean }
	| { type: "set-switcher-presented"; presented: boolean }
	| { type: "set-text-action"; action: TextSheetAction }
	| { type: "set-text-error"; error: string | null }
	| { type: "toggle-folder"; path: string }

export interface SidebarUi {
	closeSidebar: () => void
	dispatchUi: Dispatch<SidebarUiAction>
	uiState: SidebarUiState
}

export const initialSidebarUiState: SidebarUiState = {
	entryActionsEntry: null,
	expandedFolders: new Set(),
	morePresented: false,
	moveEntry: null,
	moveError: null,
	pendingVaultFolder: null,
	submitting: false,
	switcherPresented: false,
	textAction: null,
	textError: null,
}

export function sidebarUiReducer(state: SidebarUiState, action: SidebarUiAction): SidebarUiState {
	switch (action.type) {
		case "set-entry-actions-entry":
			return { ...state, entryActionsEntry: action.entry }
		case "set-expanded-folders":
			return { ...state, expandedFolders: action.folders }
		case "set-more-presented":
			return { ...state, morePresented: action.presented }
		case "set-move-entry":
			return { ...state, moveEntry: action.entry, moveError: null }
		case "set-move-error":
			return { ...state, moveError: action.error }
		case "set-pending-vault-folder":
			return { ...state, pendingVaultFolder: action.folder }
		case "set-submitting":
			return { ...state, submitting: action.submitting }
		case "set-switcher-presented":
			return { ...state, switcherPresented: action.presented }
		case "set-text-action":
			return { ...state, textAction: action.action, textError: null }
		case "set-text-error":
			return { ...state, textError: action.error }
		case "toggle-folder": {
			const expandedFolders = new Set(state.expandedFolders)
			if (expandedFolders.has(action.path)) expandedFolders.delete(action.path)
			else expandedFolders.add(action.path)
			return { ...state, expandedFolders }
		}
	}
}

export async function runSubmittingTask(
	dispatchUi: Dispatch<SidebarUiAction>,
	task: () => Promise<void>,
	onError: (error: unknown) => Promise<void> | void,
): Promise<void> {
	dispatchUi({ submitting: true, type: "set-submitting" })
	try {
		await task()
	} catch (error) {
		await onError(error)
	} finally {
		dispatchUi({ submitting: false, type: "set-submitting" })
	}
}
