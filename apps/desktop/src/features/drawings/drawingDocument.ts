import { noteCache } from "@cortex/core"
import { parseFencedCodeBlocks } from "@cortex/editor/code-block-embeds"
import { projectRawNote, replaceFrontmatterBody } from "@cortex/properties"

export const DRAWING_FENCE_LANGUAGE = "cortex-draw"
export const DRAWING_BOARD_VIEW_ID = "drawing-board"

export interface ExcalidrawSerializedScene {
	type: "excalidraw"
	version: number
	source: string
	elements: unknown[]
	appState: Record<string, unknown>
	files: Record<string, unknown>
}

export interface CortexDrawingDocumentV1 {
	schema: "cortex.drawing"
	version: 1
	engine: "excalidraw"
	id: string
	title: string
	updatedAt: string
	scene: ExcalidrawSerializedScene
}

export interface DrawingBoardViewState {
	filePath: string
	drawingId: string
}

export interface DrawingDocumentResult {
	document: CortexDrawingDocumentV1
	sourceFrom: number
	sourceTo: number
}

const emptyExcalidrawScene: ExcalidrawSerializedScene = {
	type: "excalidraw",
	version: 2,
	source: "cortex",
	elements: [],
	appState: {
		viewBackgroundColor: "#ffffff",
	},
	files: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeScene(value: unknown): ExcalidrawSerializedScene | null {
	if (!isRecord(value)) return null
	const elements = Array.isArray(value.elements) ? value.elements : []
	const appState = isRecord(value.appState) ? value.appState : {}
	const files = isRecord(value.files) ? value.files : {}
	return {
		type: "excalidraw",
		version: typeof value.version === "number" ? value.version : 2,
		source: "cortex",
		elements,
		appState,
		files,
	}
}

export function createEmptyDrawingDocument(
	title = "Drawing",
	id: string = crypto.randomUUID(),
): CortexDrawingDocumentV1 {
	return {
		schema: "cortex.drawing",
		version: 1,
		engine: "excalidraw",
		id,
		title,
		updatedAt: new Date().toISOString(),
		scene: emptyExcalidrawScene,
	}
}

export function parseDrawingDocument(content: string): CortexDrawingDocumentV1 | null {
	try {
		const parsed: unknown = JSON.parse(content.trim())
		if (!isRecord(parsed)) return null
		if (parsed.schema !== "cortex.drawing") return null
		if (parsed.version !== 1) return null
		if (parsed.engine !== "excalidraw") return null
		if (typeof parsed.id !== "string" || !parsed.id) return null
		const scene = normalizeScene(parsed.scene)
		if (!scene) return null
		return {
			schema: "cortex.drawing",
			version: 1,
			engine: "excalidraw",
			id: parsed.id,
			title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Drawing",
			updatedAt:
				typeof parsed.updatedAt === "string" && parsed.updatedAt
					? parsed.updatedAt
					: new Date(0).toISOString(),
			scene,
		}
	} catch (_error) {
		return null
	}
}

export function serializeDrawingDocument(document: CortexDrawingDocumentV1): string {
	return JSON.stringify(document)
}

export function createDrawingFence(document: CortexDrawingDocumentV1): string {
	return `\`\`\`${DRAWING_FENCE_LANGUAGE}\n${serializeDrawingDocument(document)}\n\`\`\``
}

export function findDrawingDocumentInBody(
	body: string,
	drawingId: string,
): DrawingDocumentResult | null {
	for (const block of parseFencedCodeBlocks(body, [DRAWING_FENCE_LANGUAGE])) {
		const document = parseDrawingDocument(block.content)
		if (document?.id === drawingId) {
			return {
				document,
				sourceFrom: block.sourceFrom,
				sourceTo: block.sourceTo,
			}
		}
	}
	return null
}

export async function readDrawingDocumentFromNote(
	filePath: string,
	drawingId: string,
): Promise<CortexDrawingDocumentV1 | null> {
	const entry = await noteCache.readEntry(filePath)
	return findDrawingDocumentInBody(projectRawNote(entry.content).body, drawingId)?.document ?? null
}

export async function writeDrawingDocumentToNote(
	filePath: string,
	drawingId: string,
	document: CortexDrawingDocumentV1,
	options: { flush?: boolean } = {},
): Promise<boolean> {
	const entry = await noteCache.readEntry(filePath)
	const projection = projectRawNote(entry.content)
	const blocks = parseFencedCodeBlocks(projection.body, [DRAWING_FENCE_LANGUAGE])

	for (const block of blocks) {
		const currentDocument = parseDrawingDocument(block.content)
		if (currentDocument?.id !== drawingId) continue
		const nextBody = `${projection.body.slice(0, block.contentFrom)}${serializeDrawingDocument(
			document,
		)}\n${projection.body.slice(block.contentTo)}`
		noteCache.writeExternal(filePath, replaceFrontmatterBody(entry.content, nextBody))
		if (options.flush) await noteCache.flush(filePath)
		return true
	}

	return false
}
