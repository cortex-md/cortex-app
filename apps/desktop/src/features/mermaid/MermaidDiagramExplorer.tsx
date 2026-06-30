import { Button } from "@cortex/ui"
import {
	Maximize2Icon,
	RotateCcwIcon,
	TriangleAlertIcon,
	ZoomInIcon,
	ZoomOutIcon,
} from "lucide-react"
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react"
import {
	fitCameraToViewport,
	formatSvgViewBox,
	mergeCameraBoxes,
	normalizeCameraAspect,
	panCameraByViewportDelta,
	parseSvgViewBox,
	type SvgCameraBox,
	type SvgViewportPoint,
	type SvgViewportSize,
	zoomCameraAtViewportPoint,
	zoomStep,
} from "./svgCamera"
import { useMermaidDiagram } from "./useMermaidDiagram"

interface MermaidDiagramExplorerProps {
	source: string
	title: string
	className?: string
	isActive?: boolean
}

interface DragState {
	pointerId: number
	startX: number
	startY: number
	originCamera: SvgCameraBox
}

const measuredSvgElementSelector = [
	"path",
	"rect",
	"circle",
	"ellipse",
	"line",
	"polyline",
	"polygon",
	"text",
	"image",
	"use",
	"g",
].join(",")
const nonRenderedAncestorSelector = "defs, marker, clipPath, mask, pattern, symbol"

function getViewportSize(viewport: HTMLElement): SvgViewportSize {
	const rect = viewport.getBoundingClientRect()
	return {
		width: rect.width || viewport.clientWidth,
		height: rect.height || viewport.clientHeight,
	}
}

function getActiveViewportSize(viewport: HTMLElement): SvgViewportSize | null {
	const size = getViewportSize(viewport)
	return size.width > 0 && size.height > 0 ? size : null
}

function getViewportPoint(
	viewport: HTMLElement,
	clientX?: number,
	clientY?: number,
): SvgViewportPoint {
	const size = getViewportSize(viewport)
	if (clientX === undefined || clientY === undefined) {
		return { x: size.width / 2, y: size.height / 2 }
	}

	const rect = viewport.getBoundingClientRect()
	return {
		x: clientX - rect.left,
		y: clientY - rect.top,
	}
}

function toCameraBox(box: DOMRect | SVGRect): SvgCameraBox | null {
	return mergeCameraBoxes({
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
	})
}

function canMeasureSvgElement(element: Element): element is SVGGraphicsElement {
	return "getBBox" in element && !element.closest(nonRenderedAncestorSelector)
}

function getSvgContentBox(svg: SVGSVGElement): SvgCameraBox | null {
	const boxes: SvgCameraBox[] = []

	for (const element of Array.from(svg.querySelectorAll(measuredSvgElementSelector))) {
		if (!canMeasureSvgElement(element)) continue
		try {
			const box = toCameraBox(element.getBBox())
			if (box) boxes.push(box)
		} catch {}
	}

	try {
		const rootBox = toCameraBox(svg.getBBox())
		if (rootBox) boxes.push(rootBox)
	} catch {}

	return mergeCameraBoxes(...boxes)
}

function getSvgDiagramBox(svg: SVGSVGElement): SvgCameraBox | null {
	return mergeCameraBoxes(parseSvgViewBox(svg.getAttribute("viewBox")), getSvgContentBox(svg))
}

function prepareSvgForViewport(svg: SVGSVGElement): void {
	svg.removeAttribute("width")
	svg.removeAttribute("height")
	svg.style.width = "100%"
	svg.style.height = "100%"
	svg.style.maxWidth = "none"
	svg.style.overflow = "visible"
}

export function MermaidDiagramExplorer({
	source,
	title,
	className = "",
	isActive = true,
}: MermaidDiagramExplorerProps) {
	const diagram = useMermaidDiagram(source)
	const diagramSvg = diagram.status === "success" ? diagram.svg : null
	const viewportRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const svgRef = useRef<SVGSVGElement | null>(null)
	const diagramBoxRef = useRef<SvgCameraBox | null>(null)
	const fitCameraRef = useRef<SvgCameraBox | null>(null)
	const cameraRef = useRef<SvgCameraBox | null>(null)
	const dragStateRef = useRef<DragState | null>(null)
	const renderedSourceRef = useRef<string | null>(null)
	const animationFrameRef = useRef<number | null>(null)
	const layoutFrameRef = useRef<number | null>(null)
	const userInteractedRef = useRef(false)

	const applyCamera = useCallback((camera: SvgCameraBox) => {
		const svg = svgRef.current
		if (!svg) return
		svg.setAttribute("viewBox", formatSvgViewBox(camera))
	}, [])

	const cancelScheduledCamera = useCallback(() => {
		if (animationFrameRef.current === null) return
		window.cancelAnimationFrame(animationFrameRef.current)
		animationFrameRef.current = null
	}, [])

	const cancelScheduledLayoutFit = useCallback(() => {
		if (layoutFrameRef.current === null) return
		window.cancelAnimationFrame(layoutFrameRef.current)
		layoutFrameRef.current = null
	}, [])

	const clearDragState = useCallback(() => {
		dragStateRef.current = null
		const viewport = viewportRef.current
		if (viewport) delete viewport.dataset.dragging
	}, [])

	const writeCamera = useCallback(
		(camera: SvgCameraBox, sync = false) => {
			cameraRef.current = camera
			if (sync) {
				cancelScheduledCamera()
				applyCamera(camera)
				return
			}
			if (animationFrameRef.current !== null) return
			animationFrameRef.current = window.requestAnimationFrame(() => {
				animationFrameRef.current = null
				const nextCamera = cameraRef.current
				if (nextCamera) applyCamera(nextCamera)
			})
		},
		[applyCamera, cancelScheduledCamera],
	)

	const fitDiagram = useCallback(() => {
		const viewport = viewportRef.current
		const diagramBox = diagramBoxRef.current
		if (!viewport || !diagramBox) return

		const viewportSize = getActiveViewportSize(viewport)
		if (!viewportSize) return

		const fitCamera = fitCameraToViewport(diagramBox, viewportSize)
		fitCameraRef.current = fitCamera
		userInteractedRef.current = false
		writeCamera(fitCamera, true)
	}, [writeCamera])

	const handleResize = useCallback(() => {
		const viewport = viewportRef.current
		const diagramBox = diagramBoxRef.current
		if (!viewport || !diagramBox) return

		const viewportSize = getActiveViewportSize(viewport)
		if (!viewportSize) return

		const nextFitCamera = fitCameraToViewport(diagramBox, viewportSize)
		fitCameraRef.current = nextFitCamera
		if (!userInteractedRef.current) {
			writeCamera(nextFitCamera, true)
			return
		}

		const currentCamera = cameraRef.current ?? nextFitCamera
		writeCamera(normalizeCameraAspect(currentCamera, viewportSize), true)
	}, [writeCamera])

	const zoomAt = useCallback(
		(direction: 1 | -1, clientX?: number, clientY?: number) => {
			const viewport = viewportRef.current
			const currentCamera = cameraRef.current
			const fitCamera = fitCameraRef.current
			if (!viewport || !currentCamera || !fitCamera) return

			const viewportSize = getActiveViewportSize(viewport)
			if (!viewportSize) return

			const point = getViewportPoint(viewport, clientX, clientY)
			const zoomFactor = direction > 0 ? zoomStep : 1 / zoomStep
			userInteractedRef.current = true
			writeCamera(
				zoomCameraAtViewportPoint(currentCamera, fitCamera, viewportSize, point, zoomFactor),
			)
		},
		[writeCamera],
	)

	const scheduleResize = useCallback(() => {
		if (!isActive || layoutFrameRef.current !== null) return
		layoutFrameRef.current = window.requestAnimationFrame(() => {
			layoutFrameRef.current = null
			handleResize()
		})
	}, [handleResize, isActive])

	useLayoutEffect(() => {
		if (!diagramSvg || !isActive) return
		const viewport = viewportRef.current
		const svg = contentRef.current?.querySelector<SVGSVGElement>("svg")
		if (!viewport || !svg) return

		prepareSvgForViewport(svg)
		const diagramBox = getSvgDiagramBox(svg)
		if (!diagramBox) return

		svgRef.current = svg
		diagramBoxRef.current = diagramBox
		const sourceChanged = renderedSourceRef.current !== source
		renderedSourceRef.current = source
		if (sourceChanged) {
			cameraRef.current = null
			fitCameraRef.current = null
			userInteractedRef.current = false
		}
		const viewportSize = getActiveViewportSize(viewport)
		if (viewportSize) {
			const fitCamera = fitCameraToViewport(diagramBox, viewportSize)
			const previousCamera = cameraRef.current
			fitCameraRef.current = fitCamera
			writeCamera(
				previousCamera && userInteractedRef.current
					? normalizeCameraAspect(previousCamera, viewportSize)
					: fitCamera,
				true,
			)
		}
		cancelScheduledLayoutFit()
		scheduleResize()

		const resizeObserver =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleResize)
		resizeObserver?.observe(viewport)

		return () => {
			resizeObserver?.disconnect()
			cancelScheduledCamera()
			cancelScheduledLayoutFit()
			clearDragState()
			svgRef.current = null
		}
	}, [
		cancelScheduledCamera,
		cancelScheduledLayoutFit,
		clearDragState,
		diagramSvg,
		isActive,
		scheduleResize,
		source,
		writeCamera,
	])

	useEffect(() => {
		if (!isActive) return
		const viewport = viewportRef.current
		if (!viewport) return
		const handleWheel = (event: WheelEvent) => {
			if (diagram.status !== "success") return
			event.preventDefault()
			zoomAt(event.deltaY > 0 ? -1 : 1, event.clientX, event.clientY)
		}
		viewport.addEventListener("wheel", handleWheel, { passive: false })
		return () => viewport.removeEventListener("wheel", handleWheel)
	}, [diagram.status, isActive, zoomAt])

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		const currentCamera = cameraRef.current
		if (!isActive || diagram.status !== "success" || event.button !== 0 || !currentCamera) return
		event.currentTarget.setPointerCapture?.(event.pointerId)
		dragStateRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originCamera: currentCamera,
		}
		event.currentTarget.dataset.dragging = "true"
	}

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const viewport = viewportRef.current
		const dragState = dragStateRef.current
		if (!viewport || !dragState || dragState.pointerId !== event.pointerId) return
		const viewportSize = getActiveViewportSize(viewport)
		if (!viewportSize) return

		const deltaX = event.clientX - dragState.startX
		const deltaY = event.clientY - dragState.startY
		userInteractedRef.current = true
		writeCamera(
			panCameraByViewportDelta(dragState.originCamera, viewportSize, {
				x: deltaX,
				y: deltaY,
			}),
		)
	}

	const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		const dragState = dragStateRef.current
		if (!dragState || dragState.pointerId !== event.pointerId) return
		event.currentTarget.releasePointerCapture?.(event.pointerId)
		dragStateRef.current = null
		delete event.currentTarget.dataset.dragging
	}

	return (
		<div className={`mermaid-explorer${className ? ` ${className}` : ""}`}>
			<div className="mermaid-explorer-toolbar" role="toolbar" aria-label={`${title} controls`}>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mermaid-explorer-tool"
					aria-label="Zoom out"
					title="Zoom out"
					onClick={() => zoomAt(-1)}
				>
					<ZoomOutIcon className="size-4" aria-hidden="true" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mermaid-explorer-tool"
					aria-label="Zoom in"
					title="Zoom in"
					onClick={() => zoomAt(1)}
				>
					<ZoomInIcon className="size-4" aria-hidden="true" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mermaid-explorer-tool"
					aria-label="Fit diagram"
					title="Fit diagram"
					onClick={fitDiagram}
				>
					<Maximize2Icon className="size-4" aria-hidden="true" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mermaid-explorer-tool"
					aria-label="Reset view"
					title="Reset view"
					onClick={fitDiagram}
				>
					<RotateCcwIcon className="size-4" aria-hidden="true" />
				</Button>
			</div>
			<div
				ref={viewportRef}
				className="mermaid-explorer-viewport"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			>
				{diagram.status === "loading" ? (
					<div className="mermaid-diagram-state">Rendering diagram...</div>
				) : diagram.status === "error" ? (
					<div className="mermaid-diagram-state is-error">
						<TriangleAlertIcon className="size-4" aria-hidden="true" />
						<span>{diagram.message}</span>
					</div>
				) : (
					<div
						ref={contentRef}
						className="mermaid-explorer-content"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid SVG is sanitized and namespaced before reaching this sink
						dangerouslySetInnerHTML={{ __html: diagram.svg }}
					/>
				)}
			</div>
		</div>
	)
}
