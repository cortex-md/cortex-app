import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"

export type PdfRenderStatus = "idle" | "rendering" | "ready" | "error"

export interface PdfRenderCacheOptions {
	maxEntries: number
	maxPixels: number
}

export interface PdfRenderedPageSnapshot {
	key: string
	canvas: HTMLCanvasElement
	pageNumber: number
	zoom: number
	pixelRatio: number
	pixelWidth: number
	pixelHeight: number
	viewportWidth: number
	viewportHeight: number
	pixelCount: number
}

export interface PdfPageRenderRequest {
	filePath: string
	document: PDFDocumentProxy
	pageNumber: number
	zoom: number
	cache: PdfRenderCache
	isCancelled?: () => boolean
	onRenderTask?: (renderTask: RenderTask | null) => void
}

export interface PdfPageRenderResult {
	snapshot: PdfRenderedPageSnapshot
	fromCache: boolean
}

export const MAX_CANVAS_PIXELS = 12_000_000

export class PdfRenderAbortedError extends Error {
	constructor() {
		super("PDF render aborted")
		this.name = "PdfRenderAbortedError"
	}
}

export class PdfRenderCache {
	private readonly snapshots = new Map<string, PdfRenderedPageSnapshot>()
	private readonly maxEntries: number
	private readonly maxPixels: number
	private pixelCount = 0

	constructor(options: PdfRenderCacheOptions) {
		this.maxEntries = options.maxEntries
		this.maxPixels = options.maxPixels
	}

	get(key: string): PdfRenderedPageSnapshot | null {
		const snapshot = this.snapshots.get(key)
		if (!snapshot) return null
		this.snapshots.delete(key)
		this.snapshots.set(key, snapshot)
		return snapshot
	}

	set(snapshot: PdfRenderedPageSnapshot): void {
		const existingSnapshot = this.snapshots.get(snapshot.key)
		if (existingSnapshot) {
			this.pixelCount -= existingSnapshot.pixelCount
			this.releaseSnapshot(existingSnapshot)
			this.snapshots.delete(snapshot.key)
		}

		this.snapshots.set(snapshot.key, snapshot)
		this.pixelCount += snapshot.pixelCount
		this.trim()
	}

	clear(): void {
		for (const snapshot of this.snapshots.values()) {
			this.releaseSnapshot(snapshot)
		}
		this.snapshots.clear()
		this.pixelCount = 0
	}

	private trim(): void {
		while (this.snapshots.size > this.maxEntries || this.pixelCount > this.maxPixels) {
			const oldestKey = this.snapshots.keys().next().value
			if (!oldestKey) break
			const snapshot = this.snapshots.get(oldestKey)
			this.snapshots.delete(oldestKey)
			if (!snapshot) continue
			this.pixelCount -= snapshot.pixelCount
			this.releaseSnapshot(snapshot)
		}
	}

	private releaseSnapshot(snapshot: PdfRenderedPageSnapshot): void {
		snapshot.canvas.width = 0
		snapshot.canvas.height = 0
	}
}

function normalizeCacheNumber(value: number): string {
	return value.toFixed(3)
}

function createPdfRenderCacheKey(snapshot: {
	filePath: string
	pageNumber: number
	zoom: number
	pixelRatio: number
	viewportWidth: number
	viewportHeight: number
}): string {
	return [
		snapshot.filePath,
		snapshot.pageNumber,
		normalizeCacheNumber(snapshot.zoom),
		normalizeCacheNumber(snapshot.pixelRatio),
		Math.round(snapshot.viewportWidth),
		Math.round(snapshot.viewportHeight),
	].join(":")
}

function throwIfCancelled(isCancelled: (() => boolean) | undefined): void {
	if (isCancelled?.()) throw new PdfRenderAbortedError()
}

function getDevicePixelRatio(): number {
	if (typeof window === "undefined") return 1
	return window.devicePixelRatio || 1
}

function getTargetPixelRatio(viewportWidth: number, viewportHeight: number): number {
	return Math.min(
		getDevicePixelRatio(),
		Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, viewportWidth * viewportHeight)),
	)
}

function createDetachedRenderCanvas(pixelWidth: number, pixelHeight: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas")
	canvas.width = pixelWidth
	canvas.height = pixelHeight
	return canvas
}

function getCanvasRenderingContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const context = canvas.getContext("2d")
	if (!context) {
		throw new Error("Canvas rendering is unavailable.")
	}
	return context
}

export function copyPdfSnapshotToCanvas(
	snapshot: PdfRenderedPageSnapshot,
	canvas: HTMLCanvasElement,
): void {
	const canvasContext = getCanvasRenderingContext(canvas)
	canvas.width = snapshot.pixelWidth
	canvas.height = snapshot.pixelHeight
	canvasContext.setTransform(1, 0, 0, 1, 0, 0)
	canvasContext.clearRect(0, 0, canvas.width, canvas.height)
	canvasContext.drawImage(snapshot.canvas, 0, 0)
}

export async function renderPdfPageSnapshot({
	filePath,
	document,
	pageNumber,
	zoom,
	cache,
	isCancelled,
	onRenderTask,
}: PdfPageRenderRequest): Promise<PdfPageRenderResult> {
	throwIfCancelled(isCancelled)

	const page = await document.getPage(pageNumber)
	throwIfCancelled(isCancelled)

	const viewport = page.getViewport({ scale: zoom })
	const pixelRatio = getTargetPixelRatio(viewport.width, viewport.height)
	const pixelWidth = Math.floor(viewport.width * pixelRatio)
	const pixelHeight = Math.floor(viewport.height * pixelRatio)
	const key = createPdfRenderCacheKey({
		filePath,
		pageNumber,
		zoom,
		pixelRatio,
		viewportWidth: viewport.width,
		viewportHeight: viewport.height,
	})
	const cachedSnapshot = cache.get(key)
	if (cachedSnapshot) {
		return { snapshot: cachedSnapshot, fromCache: true }
	}

	const canvas = createDetachedRenderCanvas(pixelWidth, pixelHeight)
	const canvasContext = getCanvasRenderingContext(canvas)
	canvasContext.setTransform(1, 0, 0, 1, 0, 0)
	canvasContext.clearRect(0, 0, canvas.width, canvas.height)

	const renderTask = page.render({
		canvas,
		canvasContext,
		viewport,
		transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
	})
	onRenderTask?.(renderTask)

	try {
		await renderTask.promise
		throwIfCancelled(isCancelled)
	} finally {
		onRenderTask?.(null)
	}

	const snapshot: PdfRenderedPageSnapshot = {
		key,
		canvas,
		pageNumber,
		zoom,
		pixelRatio,
		pixelWidth,
		pixelHeight,
		viewportWidth: viewport.width,
		viewportHeight: viewport.height,
		pixelCount: pixelWidth * pixelHeight,
	}
	cache.set(snapshot)

	return { snapshot, fromCache: false }
}
