import type { Tab, ViewTabState } from "@cortex/core"
import { useWorkspaceStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, Input, Progress, Spinner } from "@cortex/ui"
import {
	AlertCircleIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MinusIcon,
	PlusIcon,
	RotateCcwIcon,
} from "lucide-react"
import { GlobalWorkerOptions } from "pdfjs-dist"
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url"
import { type ChangeEvent, useCallback, useEffect, useRef } from "react"
import { getProgressValue, usePdfDocument } from "./usePdfDocument"
import { usePdfPageRenderer } from "./usePdfPageRenderer"

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface PdfTabViewProps {
	tab: Tab
	paneId: string
	isActive: boolean
}

interface PdfViewState {
	pageNumber: number
	zoom: number
}

const DEFAULT_PDF_VIEW_STATE: PdfViewState = {
	pageNumber: 1,
	zoom: 1,
}
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function normalizeNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

function normalizePdfViewState(viewState: ViewTabState | null): PdfViewState {
	return {
		pageNumber: Math.max(1, Math.round(normalizeNumber(viewState?.pageNumber, 1))),
		zoom: clamp(normalizeNumber(viewState?.zoom, DEFAULT_PDF_VIEW_STATE.zoom), MIN_ZOOM, MAX_ZOOM),
	}
}

export function PdfTabView({ tab, paneId, isActive }: PdfTabViewProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const updateTabViewState = useWorkspaceStore((s) => s.updateTabViewState)
	const { documentStatus, loadingProgress } = usePdfDocument(tab.filePath)
	const viewState = normalizePdfViewState(tab.viewState)
	const pageCount = documentStatus.type === "ready" ? documentStatus.document.numPages : 0
	const pageNumber =
		pageCount > 0 ? clamp(viewState.pageNumber, 1, pageCount) : viewState.pageNumber
	const pageInputValue = String(pageNumber)
	const progressValue = getProgressValue(loadingProgress)
	const { renderStatus, canvasFrameStyle, canvasStyle } = usePdfPageRenderer({
		filePath: tab.filePath,
		document: documentStatus.type === "ready" ? documentStatus.document : null,
		pageNumber,
		pageCount,
		zoom: viewState.zoom,
		canvasRef,
	})

	const setPdfViewState = useCallback(
		(nextState: Partial<PdfViewState>) => {
			const currentState = normalizePdfViewState(
				useWorkspaceStore
					.getState()
					.panes[paneId]?.tabs.find((candidate) => candidate.id === tab.id)?.viewState ?? null,
			)
			updateTabViewState(tab.id, paneId, {
				...currentState,
				...nextState,
			})
		},
		[paneId, tab.id, updateTabViewState],
	)

	useEffect(() => {
		if (documentStatus.type !== "ready") return
		if (viewState.pageNumber === pageNumber) return
		setPdfViewState({ pageNumber })
	}, [documentStatus.type, pageNumber, setPdfViewState, viewState.pageNumber])

	const handlePreviousPage = useCallback(() => {
		setPdfViewState({ pageNumber: Math.max(1, pageNumber - 1) })
	}, [pageNumber, setPdfViewState])

	const handleNextPage = useCallback(() => {
		setPdfViewState({
			pageNumber: pageCount > 0 ? Math.min(pageCount, pageNumber + 1) : pageNumber,
		})
	}, [pageCount, pageNumber, setPdfViewState])

	const handlePageInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const value = Number.parseInt(event.currentTarget.value, 10)
			if (!Number.isFinite(value)) return
			setPdfViewState({
				pageNumber: pageCount > 0 ? clamp(value, 1, pageCount) : Math.max(1, value),
			})
		},
		[pageCount, setPdfViewState],
	)

	const handleZoomOut = useCallback(() => {
		setPdfViewState({ zoom: clamp(viewState.zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM) })
	}, [setPdfViewState, viewState.zoom])

	const handleZoomIn = useCallback(() => {
		setPdfViewState({ zoom: clamp(viewState.zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM) })
	}, [setPdfViewState, viewState.zoom])

	const handleZoomReset = useCallback(() => {
		setPdfViewState({ zoom: DEFAULT_PDF_VIEW_STATE.zoom })
	}, [setPdfViewState])

	const handleReveal = useCallback(() => {
		void getPlatform().dialog.revealFolder(tab.filePath)
	}, [tab.filePath])

	return (
		<div
			className="absolute inset-0 flex flex-col bg-bg-primary"
			style={{ display: isActive ? "flex" : "none" }}
			aria-hidden={!isActive}
		>
			<div className="pdf-viewer-toolbar">
				<div className="pdf-viewer-title" title={tab.filePath}>
					{tab.title}
				</div>
				<fieldset className="pdf-viewer-controls" aria-label="PDF page controls">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Previous page"
						disabled={documentStatus.type !== "ready" || pageNumber <= 1}
						onClick={handlePreviousPage}
					>
						<ChevronLeftIcon className="size-4" />
					</Button>
					<Input
						size="sm"
						inputMode="numeric"
						aria-label="Page number"
						value={pageInputValue}
						disabled={documentStatus.type !== "ready"}
						className="pdf-viewer-page-input"
						onChange={handlePageInputChange}
					/>
					<span className="pdf-viewer-page-total">/ {pageCount || "-"}</span>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Next page"
						disabled={documentStatus.type !== "ready" || pageCount === 0 || pageNumber >= pageCount}
						onClick={handleNextPage}
					>
						<ChevronRightIcon className="size-4" />
					</Button>
				</fieldset>
				<fieldset className="pdf-viewer-controls" aria-label="PDF zoom controls">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Zoom out"
						disabled={documentStatus.type !== "ready" || viewState.zoom <= MIN_ZOOM}
						onClick={handleZoomOut}
					>
						<MinusIcon className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="pdf-viewer-zoom-reset"
						disabled={documentStatus.type !== "ready"}
						onClick={handleZoomReset}
					>
						<RotateCcwIcon className="size-3.5" />
						{Math.round(viewState.zoom * 100)}%
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Zoom in"
						disabled={documentStatus.type !== "ready" || viewState.zoom >= MAX_ZOOM}
						onClick={handleZoomIn}
					>
						<PlusIcon className="size-4" />
					</Button>
				</fieldset>
			</div>

			<div className="pdf-viewer-scroll">
				{documentStatus.type === "loading" && (
					<div className="pdf-viewer-message">
						<Spinner className="size-5 text-muted-foreground" />
						<span>Loading PDF...</span>
						<Progress value={progressValue} className="pdf-viewer-progress" />
					</div>
				)}
				{documentStatus.type === "error" && (
					<div className="pdf-viewer-message">
						<AlertCircleIcon className="size-6 text-destructive" />
						<span>{documentStatus.message}</span>
						<Button variant="outline" size="sm" onClick={handleReveal}>
							Reveal file
						</Button>
					</div>
				)}
				{documentStatus.type === "ready" && (
					<div className="pdf-viewer-page-shell" data-render-status={renderStatus}>
						{renderStatus === "rendering" && (
							<div className="pdf-viewer-rendering">
								<Spinner className="size-4" />
							</div>
						)}
						{renderStatus === "error" && (
							<div className="pdf-viewer-render-error">This page could not be rendered.</div>
						)}
						<div className="pdf-viewer-canvas-frame" style={canvasFrameStyle}>
							<canvas ref={canvasRef} className="pdf-viewer-canvas" style={canvasStyle} />
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
