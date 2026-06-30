import { useSyncExternalStore } from "react"

export interface DrawingModalTarget {
	filePath: string
	drawingId: string
}

const listeners = new Set<() => void>()
let drawingModalTarget: DrawingModalTarget | null = null

function emitDrawingModalChange(): void {
	for (const listener of listeners) listener()
}

function subscribeDrawingModal(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getDrawingModalSnapshot(): DrawingModalTarget | null {
	return drawingModalTarget
}

export function openDrawingModal(target: DrawingModalTarget): void {
	drawingModalTarget = target
	emitDrawingModalChange()
}

export function closeDrawingModal(): void {
	if (!drawingModalTarget) return
	drawingModalTarget = null
	emitDrawingModalChange()
}

export function useDrawingModalTarget(): DrawingModalTarget | null {
	return useSyncExternalStore(
		subscribeDrawingModal,
		getDrawingModalSnapshot,
		getDrawingModalSnapshot,
	)
}
