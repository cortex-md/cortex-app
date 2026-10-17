import { useVaultStore } from "@cortex/core"
import { createModalStore } from "@/utils/createModalStore"

export interface ShareTemplateTarget {
	kind: "note" | "database"
	templateId?: string
	databasePath?: string
}

export const shareTemplateModal = createModalStore<ShareTemplateTarget>()

export function openShareTemplate(templateId: string): void {
	if (!useVaultStore.getState().vault) return
	shareTemplateModal.open({ kind: "note", templateId })
}

export function openShareDatabaseTemplate(databasePath: string): void {
	if (!useVaultStore.getState().vault) return
	shareTemplateModal.open({ kind: "database", databasePath })
}
