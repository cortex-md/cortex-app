import { clampLeftSidebarWidth, useUIStore } from "@cortex/core"
import { useEffect, useRef } from "react"

interface SidebarResize {
	sidebarElementRef: React.RefObject<HTMLElement | null>
	handleSidebarResizeStart: (event: React.PointerEvent<HTMLElement>) => void
}

export function useSidebarResize(
	leftSidebarCollapsed: boolean,
	leftSidebarWidth: number,
	setLeftSidebarWidth: (width: number) => void,
): SidebarResize {
	const sidebarResizing = useRef(false)
	const sidebarResizeStart = useRef({ x: 0, width: 0 })
	const sidebarResizeWidth = useRef(leftSidebarWidth)
	const sidebarResizeFrame = useRef<number | null>(null)
	const sidebarResizeCleanup = useRef<(() => void) | null>(null)
	const sidebarElementRef = useRef<HTMLElement | null>(null)

	const applySidebarResizeWidth = (width: number) => {
		sidebarResizeWidth.current = clampLeftSidebarWidth(width)
		if (sidebarResizeFrame.current !== null) return
		sidebarResizeFrame.current = window.requestAnimationFrame(() => {
			sidebarResizeFrame.current = null
			if (sidebarElementRef.current) {
				sidebarElementRef.current.style.width = `${sidebarResizeWidth.current}px`
			}
		})
	}

	useEffect(() => {
		sidebarResizeWidth.current = leftSidebarWidth
		if (!sidebarResizing.current && sidebarElementRef.current) {
			sidebarElementRef.current.style.width = leftSidebarCollapsed ? "0px" : `${leftSidebarWidth}px`
		}
	}, [leftSidebarCollapsed, leftSidebarWidth])

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- unmount cleanup must read the latest resize listeners and animation frame
	useEffect(() => {
		return () => {
			sidebarResizeCleanup.current?.()
			if (sidebarResizeFrame.current !== null) {
				window.cancelAnimationFrame(sidebarResizeFrame.current)
			}
		}
	}, [])

	const handleSidebarResizeStart = (event: React.PointerEvent<HTMLElement>) => {
		if (event.button !== 0) return
		sidebarResizeCleanup.current?.()
		sidebarResizing.current = true
		sidebarResizeStart.current = { x: event.clientX, width: leftSidebarWidth }
		sidebarResizeWidth.current = leftSidebarWidth
		event.preventDefault()
		const pointerId = event.pointerId
		const handleElement = event.currentTarget
		handleElement.setPointerCapture?.(pointerId)

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (moveEvent.pointerId !== pointerId) return
			if (!sidebarResizing.current) return
			const delta = moveEvent.clientX - sidebarResizeStart.current.x
			applySidebarResizeWidth(sidebarResizeStart.current.width + delta)
		}

		const cleanupSidebarResize = () => {
			document.removeEventListener("pointermove", handlePointerMove)
			document.removeEventListener("pointerup", handlePointerEnd)
			document.removeEventListener("pointercancel", handlePointerEnd)
			if (handleElement.hasPointerCapture?.(pointerId)) {
				handleElement.releasePointerCapture(pointerId)
			}
			sidebarResizeCleanup.current = null
		}

		const handlePointerEnd = (endEvent: PointerEvent) => {
			if (endEvent.pointerId !== pointerId) return
			sidebarResizing.current = false
			if (sidebarResizeFrame.current !== null) {
				window.cancelAnimationFrame(sidebarResizeFrame.current)
				sidebarResizeFrame.current = null
			}
			if (sidebarElementRef.current) {
				sidebarElementRef.current.style.width = `${sidebarResizeWidth.current}px`
			}
			if (sidebarResizeWidth.current !== useUIStore.getState().leftSidebarWidth) {
				setLeftSidebarWidth(sidebarResizeWidth.current)
			}
			cleanupSidebarResize()
		}

		sidebarResizeCleanup.current = cleanupSidebarResize
		document.addEventListener("pointermove", handlePointerMove)
		document.addEventListener("pointerup", handlePointerEnd)
		document.addEventListener("pointercancel", handlePointerEnd)
	}

	return { sidebarElementRef, handleSidebarResizeStart }
}
