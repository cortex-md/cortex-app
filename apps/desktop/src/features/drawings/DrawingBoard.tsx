import { Button } from "@cortex/ui"
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	type CortexDrawingDocumentV1,
	type ExcalidrawSerializedScene,
	readDrawingDocumentFromNote,
	writeDrawingDocumentToNote,
} from "./drawingDocument"

interface DrawingBoardProps {
	filePath: string
	drawingId: string
}

interface ExcalidrawCanvasProps {
	document: CortexDrawingDocumentV1
	onSceneChange: (
		module: ExcalidrawModule,
		elements: unknown,
		appState: unknown,
		files: unknown,
	) => void
}

type ExcalidrawModule = typeof import("@excalidraw/excalidraw")

const SAVE_DEBOUNCE_MS = 1000

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createSceneFromSerializedJson(serializedJson: string): ExcalidrawSerializedScene | null {
	try {
		const parsed: unknown = JSON.parse(serializedJson)
		if (!isRecord(parsed)) return null
		return {
			type: "excalidraw",
			version: typeof parsed.version === "number" ? parsed.version : 2,
			source: "cortex",
			elements: Array.isArray(parsed.elements) ? parsed.elements : [],
			appState: isRecord(parsed.appState) ? parsed.appState : {},
			files: isRecord(parsed.files) ? parsed.files : {},
		}
	} catch (_error) {
		return null
	}
}

const LazyExcalidrawCanvas = lazy(async () => {
	const [excalidrawModule] = await Promise.all([
		import("@excalidraw/excalidraw"),
		import("@excalidraw/excalidraw/index.css"),
	])

	function ExcalidrawCanvas({ document, onSceneChange }: ExcalidrawCanvasProps) {
		const Excalidraw = excalidrawModule.Excalidraw
		const initialData = useMemo(
			() =>
				excalidrawModule.restore(
					{
						elements: document.scene.elements as never,
						appState: document.scene.appState as never,
						files: document.scene.files as never,
					},
					null,
					null,
				),
			[document.scene],
		)

		return (
			<Excalidraw
				initialData={initialData}
				onChange={(elements, appState, files) =>
					onSceneChange(excalidrawModule, elements, appState, files)
				}
				UIOptions={{
					tools: { image: false },
					canvasActions: {
						export: false,
						loadScene: false,
						saveAsImage: false,
						saveToActiveFile: false,
					},
				}}
			/>
		)
	}

	return { default: ExcalidrawCanvas }
})

export function DrawingBoard({ filePath, drawingId }: DrawingBoardProps) {
	const [document, setDocument] = useState<CortexDrawingDocumentV1 | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const latestDocumentRef = useRef<CortexDrawingDocumentV1 | null>(null)
	const pendingDocumentRef = useRef<CortexDrawingDocumentV1 | null>(null)
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastSceneVersionRef = useRef<number | null>(null)
	const lastSceneJsonRef = useRef<string | null>(null)

	const flushPending = useCallback(
		async (flushFile = false) => {
			const pendingDocument = pendingDocumentRef.current
			if (!pendingDocument) return
			pendingDocumentRef.current = null
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current)
				saveTimerRef.current = null
			}
			const written = await writeDrawingDocumentToNote(filePath, drawingId, pendingDocument, {
				flush: flushFile,
			})
			if (!written && !flushFile) setError("This drawing no longer exists in the note.")
		},
		[filePath, drawingId],
	)

	const scheduleSave = useCallback(
		(nextDocument: CortexDrawingDocumentV1) => {
			pendingDocumentRef.current = nextDocument
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			saveTimerRef.current = setTimeout(() => {
				void flushPending()
			}, SAVE_DEBOUNCE_MS)
		},
		[flushPending],
	)

	const handleSceneChange = useCallback(
		(module: ExcalidrawModule, elements: unknown, appState: unknown, files: unknown) => {
			const sceneVersion = module.getSceneVersion(elements as never)
			if (lastSceneVersionRef.current === sceneVersion) return
			lastSceneVersionRef.current = sceneVersion

			const serializedSceneJson = module.serializeAsJSON(
				elements as never,
				appState as never,
				files as never,
				"local",
			)
			if (lastSceneJsonRef.current === serializedSceneJson) return
			lastSceneJsonRef.current = serializedSceneJson

			const currentDocument = latestDocumentRef.current
			const scene = createSceneFromSerializedJson(serializedSceneJson)
			if (!currentDocument || !scene) return

			if (JSON.stringify(currentDocument.scene) === JSON.stringify(scene)) return

			const nextDocument: CortexDrawingDocumentV1 = {
				...currentDocument,
				updatedAt: new Date().toISOString(),
				scene,
			}
			latestDocumentRef.current = nextDocument
			setError(null)
			scheduleSave(nextDocument)
		},
		[scheduleSave],
	)

	const reloadDocument = useCallback(() => {
		let active = true
		setLoading(true)
		setError(null)
		void readDrawingDocumentFromNote(filePath, drawingId)
			.then((nextDocument) => {
				if (!active) return
				if (!nextDocument) {
					setDocument(null)
					setError("This drawing could not be found in the note.")
					return
				}
				latestDocumentRef.current = nextDocument
				lastSceneJsonRef.current = JSON.stringify(nextDocument.scene)
				setDocument(nextDocument)
			})
			.catch((reason) => {
				if (!active) return
				setError(reason instanceof Error ? reason.message : "The drawing could not be loaded.")
			})
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => {
			active = false
		}
	}, [filePath, drawingId])

	useEffect(() => reloadDocument(), [reloadDocument])

	useEffect(() => {
		return () => {
			void flushPending(true)
		}
	}, [flushPending])

	if (loading) {
		return <div className="drawing-board-state">Loading drawing...</div>
	}

	if (error || !document) {
		return (
			<div className="drawing-board-state">
				<p>{error ?? "The drawing could not be loaded."}</p>
				<Button variant="outline" size="sm" onClick={reloadDocument}>
					Retry
				</Button>
			</div>
		)
	}

	return (
		<div className="drawing-board-shell">
			<Suspense fallback={<div className="drawing-board-state">Loading canvas...</div>}>
				<LazyExcalidrawCanvas document={document} onSceneChange={handleSceneChange} />
			</Suspense>
		</div>
	)
}
