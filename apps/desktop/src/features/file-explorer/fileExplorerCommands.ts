export const FILE_EXPLORER_COMMAND_IDS = {
	openMenu: "file-explorer.open-menu",
	rename: "file-explorer.rename",
	delete: "file-explorer.delete",
} as const

export type FileExplorerCommandId =
	(typeof FILE_EXPLORER_COMMAND_IDS)[keyof typeof FILE_EXPLORER_COMMAND_IDS]

export type FileExplorerCommandHandler = (
	commandId: FileExplorerCommandId,
	filePath: string | null,
) => void

let activeHandler: FileExplorerCommandHandler | null = null

export function setFileExplorerCommandHandler(handler: FileExplorerCommandHandler): () => void {
	activeHandler = handler
	return () => {
		if (activeHandler === handler) activeHandler = null
	}
}

export function runFileExplorerCommand(
	commandId: FileExplorerCommandId,
	filePath: string | null = null,
): void {
	activeHandler?.(commandId, filePath)
}
