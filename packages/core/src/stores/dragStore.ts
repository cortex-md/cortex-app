import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export type DragSourceType = "tab" | "file" | "sidebar-view"

export interface TabDragSource {
	type: "tab"
	tabId: string
	sourcePaneId: string
}

export interface FileDragSource {
	type: "file"
	filePath: string
	isDirectory?: boolean
}

export interface SidebarViewDragSource {
	type: "sidebar-view"
	viewId: string
	viewTitle: string
}

export type DragSource = TabDragSource | FileDragSource | SidebarViewDragSource

export type DropZone = "center" | "left" | "right" | "top" | "bottom"

export type DropTargetType = "pane" | "tab" | "file-tree"
export type FileTreeDropPosition = "inside" | "before" | "after" | "root"

export interface DropTarget {
	type?: DropTargetType
	paneId?: string
	zone?: DropZone
	tabId?: string
	tabPosition?: "before" | "after"
	insertIndex?: number
	fileTreePath?: string
	fileTreeParentPath?: string
	fileTreePosition?: FileTreeDropPosition
}

export interface DragPosition {
	x: number
	y: number
}

export interface DragState {
	dragSource: DragSource | null
	dropTarget: DropTarget | null
	dragPosition: DragPosition | null

	startDrag: (source: DragSource) => void
	updateDropTarget: (target: DropTarget | null) => void
	updateDragPosition: (position: DragPosition | null) => void
	completeDrop: () => Promise<void>
	cancelDrag: () => void
}

function normalizeDropZone(
	zone: DropZone,
	paneId: string,
	workspace: import("./workspaceStore").WorkspaceState,
): DropZone {
	const targetPane = workspace.panes[paneId]
	const isOnlyEmptyPane = Object.keys(workspace.panes).length === 1 && targetPane?.tabs.length === 0
	return isOnlyEmptyPane ? "center" : zone
}

function getSplitPlacement(zone: DropZone): {
	direction: "horizontal" | "vertical"
	position: "before" | "after"
} {
	return {
		direction: zone === "left" || zone === "right" ? "horizontal" : "vertical",
		position: zone === "left" || zone === "top" ? "before" : "after",
	}
}

export const useDragStore = create<DragState>()(
	devtools(
		immer((set, get) => ({
			dragSource: null,
			dropTarget: null,
			dragPosition: null,

			startDrag: (source) => {
				set((s) => {
					s.dragSource = source
					s.dropTarget = null
					s.dragPosition = null
				})
			},

			updateDropTarget: (target) => {
				set((s) => {
					s.dropTarget = target
				})
			},

			updateDragPosition: (position) => {
				set((s) => {
					s.dragPosition = position
				})
			},

			completeDrop: async () => {
				const { dragSource, dropTarget } = get()
				if (!dragSource || !dropTarget) {
					get().cancelDrag()
					return
				}

				const source = structuredClone(dragSource) as DragSource
				const target = structuredClone(dropTarget) as DropTarget

				set((s) => {
					s.dragSource = null
					s.dropTarget = null
					s.dragPosition = null
				})

				if (target.type === "file-tree") {
					if (source.type === "file" && target.fileTreeParentPath) {
						const { useVaultStore } = await import("./vaultStore")
						await useVaultStore.getState().moveFile(source.filePath, target.fileTreeParentPath)
					}
					return
				}

				const targetPaneId = target.paneId
				if (!targetPaneId) return
				const { useWorkspaceStore } = await import("./workspaceStore")
				const workspace = useWorkspaceStore.getState()
				const zone = normalizeDropZone(target.zone ?? "center", targetPaneId, workspace)
				const insertIndex = target.type === "tab" ? target.insertIndex : undefined

				if (source.type === "tab") {
					const { tabId, sourcePaneId } = source

					if (target.type === "tab" || zone === "center") {
						workspace.moveTab(tabId, sourcePaneId, targetPaneId, insertIndex)
					} else {
						const { direction, position } = getSplitPlacement(zone)
						workspace.moveTabToNewSplit(tabId, sourcePaneId, targetPaneId, direction, position)
					}
				} else if (source.type === "file") {
					const { filePath } = source
					if (source.isDirectory) return

					if (target.type === "tab" || zone === "center") {
						workspace.openTab(filePath, {
							paneId: targetPaneId,
							forceNew: true,
							insertIndex,
						})
					} else {
						const { direction, position } = getSplitPlacement(zone)
						workspace.openTab(filePath, {
							paneId: targetPaneId,
							split: direction,
							splitPosition: position,
							forceNew: true,
						})
					}
				} else if (source.type === "sidebar-view") {
					const { viewId, viewTitle } = source

					if (target.type === "tab" || zone === "center") {
						workspace.openViewTab(viewId, viewTitle, {
							paneId: targetPaneId,
							forceNew: true,
							insertIndex,
						})
					} else {
						const { direction, position } = getSplitPlacement(zone)
						workspace.openViewTab(viewId, viewTitle, {
							paneId: targetPaneId,
							split: direction,
							splitPosition: position,
							forceNew: true,
						})
					}
				}
			},

			cancelDrag: () => {
				set((s) => {
					s.dragSource = null
					s.dropTarget = null
					s.dragPosition = null
				})
			},
		})),
		{ name: "dragStore" },
	),
)
