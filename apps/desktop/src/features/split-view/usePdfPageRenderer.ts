import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { RenderingCancelledException } from "pdfjs-dist"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import {
	copyPdfSnapshotToCanvas,
	PdfRenderAbortedError,
	PdfRenderCache,
	type PdfRenderedPageSnapshot,
	type PdfRenderStatus,
	renderPdfPageSnapshot,
} from "./pdfViewer"

interface UsePdfPageRendererOptions {
	filePath: string
	document: PDFDocumentProxy | null
	pageNumber: number
	pageCount: number
	zoom: number
	canvasRef: { current: HTMLCanvasElement | null }
}

interface UsePdfPageRendererResult {
	renderStatus: PdfRenderStatus
	canvasFrameStyle: CSSProperties | undefined
	canvasStyle: CSSProperties | undefined
}

const PDF_RENDER_CACHE_MAX_ENTRIES = 5
const PDF_RENDER_CACHE_MAX_PIXELS = 24_000_000
const PDF_ZOOM_RENDER_DEBOUNCE_MS = 150
const PDF_PREFETCH_DELAY_MS = 80

const pdfRenderCache = new PdfRenderCache({
	maxEntries: PDF_RENDER_CACHE_MAX_ENTRIES,
	maxPixels: PDF_RENDER_CACHE_MAX_PIXELS,
})

function isRenderAbort(error: unknown): boolean {
	return error instanceof PdfRenderAbortedError || error instanceof RenderingCancelledException
}

function cancelRenderTask(renderTask: RenderTask | null): void {
	if (!renderTask) return
	try {
		renderTask.cancel()
	} catch (error) {
		void error
	}
}

function useDebouncedZoom(zoom: number): number {
	const [debouncedZoom, setDebouncedZoom] = useState(zoom)

	useEffect(() => {
		if (debouncedZoom === zoom) return
		const timeoutId = window.setTimeout(() => {
			setDebouncedZoom(zoom)
		}, PDF_ZOOM_RENDER_DEBOUNCE_MS)
		return () => window.clearTimeout(timeoutId)
	}, [debouncedZoom, zoom])

	return debouncedZoom
}

function createCanvasFrameStyle(
	snapshot: PdfRenderedPageSnapshot | null,
	zoom: number,
): CSSProperties | undefined {
	if (!snapshot) return undefined
	const visualScale = Math.max(0.01, zoom / snapshot.zoom)
	return {
		width: snapshot.viewportWidth * visualScale,
		height: snapshot.viewportHeight * visualScale,
	}
}

function createCanvasStyle(
	snapshot: PdfRenderedPageSnapshot | null,
	zoom: number,
): CSSProperties | undefined {
	if (!snapshot) return undefined
	const visualScale = Math.max(0.01, zoom / snapshot.zoom)
	return {
		width: snapshot.viewportWidth,
		height: snapshot.viewportHeight,
		transform: visualScale === 1 ? undefined : `scale(${visualScale})`,
	}
}

export function clearPdfRenderCacheForTests(): void {
	pdfRenderCache.clear()
}

export function usePdfPageRenderer({
	filePath,
	document,
	pageNumber,
	pageCount,
	zoom,
	canvasRef,
}: UsePdfPageRendererOptions): UsePdfPageRendererResult {
	const debouncedZoom = useDebouncedZoom(zoom)
	const [renderStatus, setRenderStatus] = useState<PdfRenderStatus>("idle")
	const [renderedSnapshot, setRenderedSnapshot] = useState<PdfRenderedPageSnapshot | null>(null)
	const currentRenderTaskRef = useRef<RenderTask | null>(null)
	const prefetchRenderTaskRef = useRef<RenderTask | null>(null)
	const prefetchTimeoutRef = useRef<number | null>(null)
	const renderGenerationRef = useRef(0)

	useEffect(() => {
		if (!document) {
			setRenderStatus("idle")
			setRenderedSnapshot(null)
			return
		}

		const pdfDocument = document
		let active = true
		const generation = renderGenerationRef.current + 1
		renderGenerationRef.current = generation

		function cancelPrefetch(): void {
			if (prefetchTimeoutRef.current !== null) {
				window.clearTimeout(prefetchTimeoutRef.current)
				prefetchTimeoutRef.current = null
			}
			cancelRenderTask(prefetchRenderTaskRef.current)
			prefetchRenderTaskRef.current = null
		}

		cancelRenderTask(currentRenderTaskRef.current)
		currentRenderTaskRef.current = null
		cancelPrefetch()
		setRenderStatus("rendering")

		function isCancelled(): boolean {
			return !active || renderGenerationRef.current !== generation
		}

		async function prefetchAdjacentPages(): Promise<void> {
			const adjacentPages = [pageNumber + 1, pageNumber - 1].filter(
				(candidatePage) => candidatePage >= 1 && candidatePage <= pageCount,
			)

			for (const adjacentPage of adjacentPages) {
				if (isCancelled()) return
				try {
					await renderPdfPageSnapshot({
						filePath,
						document: pdfDocument,
						pageNumber: adjacentPage,
						zoom: debouncedZoom,
						cache: pdfRenderCache,
						isCancelled,
						onRenderTask: (renderTask) => {
							prefetchRenderTaskRef.current = renderTask
						},
					})
				} catch (error) {
					if (isRenderAbort(error)) return
				}
			}
		}

		function schedulePrefetch(): void {
			prefetchTimeoutRef.current = window.setTimeout(() => {
				prefetchTimeoutRef.current = null
				void prefetchAdjacentPages()
			}, PDF_PREFETCH_DELAY_MS)
		}

		async function renderCurrentPage(): Promise<void> {
			try {
				const { snapshot } = await renderPdfPageSnapshot({
					filePath,
					document: pdfDocument,
					pageNumber,
					zoom: debouncedZoom,
					cache: pdfRenderCache,
					isCancelled,
					onRenderTask: (renderTask) => {
						currentRenderTaskRef.current = renderTask
					},
				})
				if (isCancelled()) return

				const canvas = canvasRef.current
				if (!canvas) return
				copyPdfSnapshotToCanvas(snapshot, canvas)
				if (isCancelled()) return
				setRenderedSnapshot(snapshot)
				setRenderStatus("ready")
				schedulePrefetch()
			} catch (error) {
				if (isRenderAbort(error) || isCancelled()) return
				setRenderStatus("error")
			}
		}

		void renderCurrentPage()

		return () => {
			active = false
			cancelRenderTask(currentRenderTaskRef.current)
			currentRenderTaskRef.current = null
			cancelPrefetch()
		}
	}, [canvasRef, debouncedZoom, document, filePath, pageCount, pageNumber])

	const canvasFrameStyle = useMemo(
		() => createCanvasFrameStyle(renderedSnapshot, zoom),
		[renderedSnapshot, zoom],
	)
	const canvasStyle = useMemo(
		() => createCanvasStyle(renderedSnapshot, zoom),
		[renderedSnapshot, zoom],
	)

	return { renderStatus, canvasFrameStyle, canvasStyle }
}
