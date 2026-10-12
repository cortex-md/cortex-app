import { useEditorStore } from "../stores/editorStore"
import { useVaultStore } from "../stores/vaultStore"
import { type OpenTabOptions, useWorkspaceStore } from "../stores/workspaceStore"
import { createWikiLinkResolver } from "../utils/links"

export function resolveWikiLink(target: string): string | null {
	const { vault, files } = useVaultStore.getState()
	if (!vault) return null
	return createWikiLinkResolver(files, vault.path)(target)
}

export async function openWikiLink(target: string, options?: OpenTabOptions): Promise<void> {
	const { vault, createFile } = useVaultStore.getState()
	if (!vault) return
	const filePath = resolveWikiLink(target) ?? (await createFile(vault.path, target.trim()))
	useWorkspaceStore.getState().openTab(filePath, options)
}

export function openNoteAtLine(filePath: string, line: number, options?: OpenTabOptions): void {
	useWorkspaceStore.getState().openTab(filePath, options)
	useEditorStore.getState().requestReveal(filePath, line)
}
