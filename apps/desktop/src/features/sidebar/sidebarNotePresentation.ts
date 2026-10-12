import { getNoteFolderSegments, getNotePathPresentation } from "@cortex/core"

export interface SidebarNotePresentation {
	title: string
	folder: string
}

export function getSidebarNotePresentation(
	filePath: string,
	vaultPath: string | undefined,
): SidebarNotePresentation {
	return {
		title: getNotePathPresentation(filePath, vaultPath).title,
		folder: getNoteFolderSegments(filePath, vaultPath)
			.map((segment) => segment.label)
			.join("/"),
	}
}
