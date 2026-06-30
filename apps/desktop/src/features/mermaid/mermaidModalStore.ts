import { useSyncExternalStore } from "react"
import type { MermaidDiagramReference } from "./mermaidDocument"

export type MermaidModalTarget = MermaidDiagramReference

const listeners = new Set<() => void>()
let mermaidModalTarget: MermaidModalTarget | null = null

function emitMermaidModalChange(): void {
	for (const listener of listeners) listener()
}

function subscribeMermaidModal(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getMermaidModalSnapshot(): MermaidModalTarget | null {
	return mermaidModalTarget
}

export function openMermaidModal(target: MermaidModalTarget): void {
	mermaidModalTarget = target
	emitMermaidModalChange()
}

export function closeMermaidModal(): void {
	if (!mermaidModalTarget) return
	mermaidModalTarget = null
	emitMermaidModalChange()
}

export function useMermaidModalTarget(): MermaidModalTarget | null {
	return useSyncExternalStore(
		subscribeMermaidModal,
		getMermaidModalSnapshot,
		getMermaidModalSnapshot,
	)
}
