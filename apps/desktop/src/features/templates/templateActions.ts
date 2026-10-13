import { useVaultStore, useWorkspaceStore } from "@cortex/core"
import { createModalStore } from "@/utils/createModalStore"
import { TEMPLATE_EDITOR_VIEW_ID, TEMPLATES_VIEW_ID } from "./templateViewIds"

export type NewTemplateStart = "note" | "blank" | "copy"

export interface NewTemplateTarget {
	start?: NewTemplateStart
	notePath?: string
	copyTemplateId?: string
}

export const newTemplateModal = createModalStore<NewTemplateTarget>()

export function openNewTemplate(target: NewTemplateTarget = {}): void {
	if (!useVaultStore.getState().vault) return
	newTemplateModal.open(target)
}

function findViewTab(
	viewId: string,
	matches: (viewState: Record<string, unknown> | null) => boolean = () => true,
): { tabId: string; paneId: string } | null {
	for (const [paneId, pane] of Object.entries(useWorkspaceStore.getState().panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType === "view" && tab.viewId === viewId && matches(tab.viewState)) {
				return { tabId: tab.id, paneId }
			}
		}
	}
	return null
}

export function openTemplatesView(templateId?: string): boolean {
	if (!useVaultStore.getState().vault) return false
	const workspace = useWorkspaceStore.getState()
	const viewState = templateId ? { templateId } : {}
	const existing = findViewTab(TEMPLATES_VIEW_ID)
	if (existing) {
		workspace.updateViewTab(existing.tabId, existing.paneId, { title: "Templates", viewState })
		workspace.activateTab(existing.tabId, existing.paneId)
		return true
	}
	workspace.openViewTab(TEMPLATES_VIEW_ID, "Templates", { viewState })
	return true
}

export function openTemplateEditor(templateId: string, title: string): boolean {
	if (!useVaultStore.getState().vault) return false
	const workspace = useWorkspaceStore.getState()
	const existing = findViewTab(
		TEMPLATE_EDITOR_VIEW_ID,
		(viewState) => viewState?.templateId === templateId,
	)
	if (existing) {
		workspace.updateViewTab(existing.tabId, existing.paneId, { title })
		workspace.activateTab(existing.tabId, existing.paneId)
		return true
	}
	workspace.openViewTab(TEMPLATE_EDITOR_VIEW_ID, title, { viewState: { templateId } })
	return true
}

export function retitleTemplateEditor(templateId: string, title: string): void {
	const existing = findViewTab(
		TEMPLATE_EDITOR_VIEW_ID,
		(viewState) => viewState?.templateId === templateId,
	)
	if (!existing) return
	const pane = useWorkspaceStore.getState().panes[existing.paneId]
	const tab = pane?.tabs.find((item) => item.id === existing.tabId)
	if (tab?.title === title) return
	useWorkspaceStore.getState().updateViewTab(existing.tabId, existing.paneId, { title })
}
