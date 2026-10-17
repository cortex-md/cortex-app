import { create } from "zustand"
import type { ExtensionSyncKind } from "./plan"

export interface ExtensionSyncStatus {
	state: "idle" | "syncing" | "error"
	inSync: number
	unavailable: string[]
	awaitingApproval: string[]
	communityOff: string[]
	failed: string[]
}

export type ExtensionSyncState = Record<ExtensionSyncKind, ExtensionSyncStatus>

export function createEmptyExtensionSyncStatus(): ExtensionSyncStatus {
	return {
		state: "idle",
		inSync: 0,
		unavailable: [],
		awaitingApproval: [],
		communityOff: [],
		failed: [],
	}
}

export const useExtensionSyncStore = create<ExtensionSyncState>()(() => ({
	plugins: createEmptyExtensionSyncStatus(),
	themes: createEmptyExtensionSyncStatus(),
}))

export function setExtensionSyncStatus(
	kind: ExtensionSyncKind,
	patch: Partial<ExtensionSyncStatus>,
): void {
	useExtensionSyncStore.setState((state) => ({ [kind]: { ...state[kind], ...patch } }))
}

export function resetExtensionSyncStatus(): void {
	useExtensionSyncStore.setState({
		plugins: createEmptyExtensionSyncStatus(),
		themes: createEmptyExtensionSyncStatus(),
	})
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : pluralForm}`
}

export function formatExtensionSyncStatus(
	kind: ExtensionSyncKind,
	status: ExtensionSyncStatus,
): string {
	if (status.state === "syncing") return kind === "plugins" ? "Syncing plugins…" : "Syncing themes…"
	const parts = [`${plural(status.inSync, kind === "plugins" ? "plugin" : "theme")} in sync`]
	if (status.awaitingApproval.length > 0) {
		parts.push(`${status.awaitingApproval.length} waiting for approval`)
	}
	if (status.unavailable.length > 0) {
		parts.push(`${status.unavailable.length} not available here`)
	}
	if (status.communityOff.length > 0) {
		parts.push(`${status.communityOff.length} need community plugins`)
	}
	if (status.failed.length > 0) parts.push(`${status.failed.length} failed, will retry`)
	return parts.join(" · ")
}

export function needsExtensionSyncReview(status: ExtensionSyncStatus): boolean {
	return (
		status.awaitingApproval.length > 0 ||
		status.unavailable.length > 0 ||
		status.communityOff.length > 0 ||
		status.failed.length > 0
	)
}
