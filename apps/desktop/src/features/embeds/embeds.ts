import { useWorkspaceStore, type ViewTabState } from "@cortex/core"
import { type ReactNode, useSyncExternalStore } from "react"
import { createModalStore } from "@/utils/createModalStore"

export interface EmbedModalTarget {
	kind: "drawing" | "mermaid"
	title: string
	body: ReactNode
	openInTab: () => void
}

export interface EmbedPortal {
	id: number
	container: HTMLElement
	node: ReactNode
}

export const embedModal = createModalStore<EmbedModalTarget>()

const portalListeners = new Set<() => void>()
let embedPortals: EmbedPortal[] = []
let nextPortalId = 0

function subscribeEmbedPortals(listener: () => void): () => void {
	portalListeners.add(listener)
	return () => {
		portalListeners.delete(listener)
	}
}

function getEmbedPortals(): EmbedPortal[] {
	return embedPortals
}

function setEmbedPortals(next: EmbedPortal[]): void {
	embedPortals = next
	for (const listener of portalListeners) listener()
}

export function mountEmbedPortal(container: HTMLElement, node: ReactNode): () => void {
	const portal: EmbedPortal = { id: nextPortalId++, container, node }
	setEmbedPortals([...embedPortals, portal])
	return () => {
		if (!embedPortals.includes(portal)) return
		setEmbedPortals(embedPortals.filter((entry) => entry !== portal))
	}
}

export function useEmbedPortals(): EmbedPortal[] {
	return useSyncExternalStore(subscribeEmbedPortals, getEmbedPortals, getEmbedPortals)
}

export function openEmbedViewTab(viewId: string, title: string, viewState: ViewTabState): void {
	useWorkspaceStore.getState().openViewTab(viewId, title, {
		forceNew: true,
		ephemeral: true,
		viewState,
	})
}
