import { useUIStore, useWorkspaceStore } from "@cortex/core"
import { useCallback, useEffect, useRef } from "react"
import { reportAppError } from "../utils/reportAppError"

type PersistWorkspace = (vaultPath: string) => Promise<void>

export function useWorkspacePersistence(
	persistWorkspace: PersistWorkspace,
): PersistWorkspaceListener {
	const persistWorkspaceRef = useRef(persistWorkspace)

	useEffect(() => {
		persistWorkspaceRef.current = persistWorkspace
	}, [persistWorkspace])

	return useCallback((vaultPath: string) => {
		let persistTimer: number | null = null
		const schedulePersistWorkspace = () => {
			if (persistTimer) window.clearTimeout(persistTimer)
			persistTimer = window.setTimeout(() => {
				persistWorkspaceRef.current(vaultPath).catch((error) => {
					void reportAppError({
						operation: "persist-workspace",
						source: "workspace-lifecycle",
						cause: error,
						context: { vaultPath },
					})
				})
			}, 500)
		}
		const unsubscribeWorkspace = useWorkspaceStore.subscribe((state, previousState) => {
			if (
				state.panes !== previousState.panes ||
				state.splitTree !== previousState.splitTree ||
				state.activePaneId !== previousState.activePaneId
			) {
				schedulePersistWorkspace()
			}
		})
		const unsubscribeUI = useUIStore.subscribe((state, previousState) => {
			if (
				state.leftSidebarCollapsed !== previousState.leftSidebarCollapsed ||
				state.leftSidebarWidth !== previousState.leftSidebarWidth
			) {
				schedulePersistWorkspace()
			}
		})
		schedulePersistWorkspace()
		return () => {
			if (persistTimer) window.clearTimeout(persistTimer)
			unsubscribeWorkspace()
			unsubscribeUI()
		}
	}, [])
}

type PersistWorkspaceListener = (vaultPath: string) => () => void
