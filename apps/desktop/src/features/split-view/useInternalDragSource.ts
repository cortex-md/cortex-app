import type { DragSource, DropTarget, DropZone } from "@cortex/core"
import { useDragStore } from "@cortex/core"
import { useCallback, useRef } from "react"

interface Options {
	disabled?: boolean
	onDragEnd?: () => void
	onDropError?: (error: unknown) => void
	onDragStart?: () => void
}

const DRAG_THRESHOLD = 6
const dropFileTreeRootSelector = "[data-file-tree-root-drop-target]"
const dropFileTreeSelector = "[data-file-tree-drop-target]"
const dropPaneSelector = "[data-drop-pane-id]"
const dropTabSelector = "[data-drop-tab-id]"
const dropTabBarSelector = "[data-drop-tabbar-pane-id]"

function calculateDropZone(rect: DOMRect, clientX: number, clientY: number): DropZone {
	const relX = (clientX - rect.left) / rect.width
	const relY = (clientY - rect.top) / rect.height
	const edgeThreshold = 0.25

	if (relX < edgeThreshold) return "left"
	if (relX > 1 - edgeThreshold) return "right"
	if (relY < edgeThreshold) return "top"
	if (relY > 1 - edgeThreshold) return "bottom"
	return "center"
}

function findDropPane(clientX: number, clientY: number): HTMLElement | null {
	const elements = document.elementsFromPoint?.(clientX, clientY) ?? []
	for (const element of elements) {
		if (!(element instanceof HTMLElement)) continue
		const pane = element.closest<HTMLElement>(dropPaneSelector)
		if (pane) return pane
	}
	return null
}

function getPathName(filePath: string): string {
	return filePath.split("/").pop() ?? filePath
}

function isPathOrDescendant(path: string, parentPath: string): boolean {
	return path === parentPath || path.startsWith(`${parentPath}/`)
}

function findFileTreeDropElement(clientX: number, clientY: number): HTMLElement | null {
	const elements = document.elementsFromPoint?.(clientX, clientY) ?? []
	for (const element of elements) {
		if (!(element instanceof HTMLElement)) continue
		const target = element.closest<HTMLElement>(dropFileTreeSelector)
		if (target) return target
	}
	return null
}

function findFileTreeRootDropElement(clientX: number, clientY: number): HTMLElement | null {
	const elements = document.elementsFromPoint?.(clientX, clientY) ?? []
	for (const element of elements) {
		if (!(element instanceof HTMLElement)) continue
		const target = element.closest<HTMLElement>(dropFileTreeRootSelector)
		if (target) return target
	}
	return null
}

function getFileTreeDropTarget(target: HTMLElement, clientY: number): DropTarget | null {
	const filePath = target.dataset.fileTreePath
	const parentPath = target.dataset.fileTreeParentPath
	if (!filePath || !parentPath) return null

	const rect = target.getBoundingClientRect()
	const relativeY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5
	const isDirectory = target.dataset.fileTreeIsDirectory === "true"
	const fileTreePosition =
		isDirectory && relativeY >= 0.25 && relativeY <= 0.75
			? "inside"
			: relativeY < 0.5
				? "before"
				: "after"

	return {
		type: "file-tree",
		fileTreePath: filePath,
		fileTreeParentPath: fileTreePosition === "inside" ? filePath : parentPath,
		fileTreePosition,
	}
}

function getFileTreeRootDropTarget(target: HTMLElement): DropTarget | null {
	const rootPath = target.dataset.fileTreeRootPath
	if (!rootPath) return null
	return {
		type: "file-tree",
		fileTreeParentPath: rootPath,
		fileTreePosition: "root",
	}
}

function isValidFileTreeDropTarget(source: DragSource, target: DropTarget): boolean {
	if (source.type !== "file" || !target.fileTreeParentPath) return false
	const destinationPath = `${target.fileTreeParentPath}/${getPathName(source.filePath)}`
	if (destinationPath === source.filePath) return false
	if (target.fileTreeParentPath === source.filePath) return false
	if (source.isDirectory && isPathOrDescendant(target.fileTreeParentPath, source.filePath)) {
		return false
	}
	return true
}

function updateDropTarget(clientX: number, clientY: number): void {
	useDragStore.getState().updateDragPosition({ x: clientX, y: clientY })
	const source = useDragStore.getState().dragSource
	const fileTreeTarget = findFileTreeDropElement(clientX, clientY)
	if (source && fileTreeTarget) {
		const target = getFileTreeDropTarget(fileTreeTarget, clientY)
		useDragStore
			.getState()
			.updateDropTarget(target && isValidFileTreeDropTarget(source, target) ? target : null)
		return
	}

	const fileTreeRootTarget = findFileTreeRootDropElement(clientX, clientY)
	if (source && fileTreeRootTarget) {
		const target = getFileTreeRootDropTarget(fileTreeRootTarget)
		useDragStore
			.getState()
			.updateDropTarget(target && isValidFileTreeDropTarget(source, target) ? target : null)
		return
	}

	if (source?.type === "file" && source.isDirectory) {
		useDragStore.getState().updateDropTarget(null)
		return
	}

	const tab = findDropTab(clientX, clientY)
	if (tab) {
		const paneId = tab.dataset.dropTabPaneId
		const tabId = tab.dataset.dropTabId
		const tabIndex = Number(tab.dataset.dropTabIndex)
		if (paneId && tabId && Number.isFinite(tabIndex)) {
			const position =
				clientX < tab.getBoundingClientRect().left + tab.getBoundingClientRect().width / 2
					? "before"
					: "after"
			useDragStore.getState().updateDropTarget({
				type: "tab",
				paneId,
				tabId,
				tabPosition: position,
				insertIndex: tabIndex + (position === "after" ? 1 : 0),
			})
			return
		}
	}

	const tabBar = findDropTabBar(clientX, clientY)
	if (tabBar) {
		const paneId = tabBar.dataset.dropTabbarPaneId
		const tabCount = Number(tabBar.dataset.dropTabbarCount)
		if (paneId && Number.isFinite(tabCount)) {
			useDragStore.getState().updateDropTarget({
				type: "tab",
				paneId,
				insertIndex: tabCount,
			})
			return
		}
	}

	const pane = findDropPane(clientX, clientY)
	const paneId = pane?.dataset.dropPaneId
	if (!pane || !paneId) {
		useDragStore.getState().updateDropTarget(null)
		return
	}

	const zone = calculateDropZone(pane.getBoundingClientRect(), clientX, clientY)
	useDragStore.getState().updateDropTarget({ type: "pane", paneId, zone })
}

function findDropTab(clientX: number, clientY: number): HTMLElement | null {
	const elements = document.elementsFromPoint?.(clientX, clientY) ?? []
	for (const element of elements) {
		if (!(element instanceof HTMLElement)) continue
		const tab = element.closest<HTMLElement>(dropTabSelector)
		if (tab) return tab
	}
	return null
}

function findDropTabBar(clientX: number, clientY: number): HTMLElement | null {
	const elements = document.elementsFromPoint?.(clientX, clientY) ?? []
	for (const element of elements) {
		if (!(element instanceof HTMLElement)) continue
		const tabBar = element.closest<HTMLElement>(dropTabBarSelector)
		if (tabBar) return tabBar
	}
	return null
}

export function useInternalDragSource(createSource: () => DragSource, options?: Options) {
	const suppressClickRef = useRef(false)

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (options?.disabled || event.button !== 0 || !event.isPrimary) return

			const startX = event.clientX
			const startY = event.clientY
			let isDragging = false

			const cleanup = () => {
				document.removeEventListener("pointermove", handlePointerMove, true)
				document.removeEventListener("pointerup", handlePointerUp, true)
				document.removeEventListener("pointercancel", handlePointerCancel, true)
				document.body.style.userSelect = ""
			}

			const startInternalDrag = () => {
				if (isDragging) return
				isDragging = true
				suppressClickRef.current = true
				document.body.style.userSelect = "none"
				useDragStore.getState().startDrag(createSource())
				useDragStore.getState().updateDragPosition({ x: startX, y: startY })
				options?.onDragStart?.()
			}

			const handlePointerMove = (pointerEvent: PointerEvent) => {
				const deltaX = pointerEvent.clientX - startX
				const deltaY = pointerEvent.clientY - startY
				if (!isDragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return

				startInternalDrag()
				pointerEvent.preventDefault()
				updateDropTarget(pointerEvent.clientX, pointerEvent.clientY)
			}

			const handlePointerUp = (pointerEvent: PointerEvent) => {
				cleanup()
				if (!isDragging) return

				pointerEvent.preventDefault()
				useDragStore
					.getState()
					.updateDragPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY })
				updateDropTarget(pointerEvent.clientX, pointerEvent.clientY)
				void useDragStore
					.getState()
					.completeDrop()
					.catch((error) => {
						options?.onDropError?.(error)
					})
				options?.onDragEnd?.()
				window.setTimeout(() => {
					suppressClickRef.current = false
				}, 0)
			}

			const handlePointerCancel = () => {
				cleanup()
				if (isDragging) {
					useDragStore.getState().cancelDrag()
					options?.onDragEnd?.()
				}
				window.setTimeout(() => {
					suppressClickRef.current = false
				}, 0)
			}

			document.addEventListener("pointermove", handlePointerMove, true)
			document.addEventListener("pointerup", handlePointerUp, true)
			document.addEventListener("pointercancel", handlePointerCancel, true)
		},
		[createSource, options],
	)

	const handleClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
		if (!suppressClickRef.current) return
		event.preventDefault()
		event.stopPropagation()
		suppressClickRef.current = false
	}, [])

	const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>) => {
		event.preventDefault()
	}, [])

	return {
		draggable: false,
		onClickCapture: handleClickCapture,
		onDragStart: handleDragStart,
		onPointerDown: handlePointerDown,
	}
}
