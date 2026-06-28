export const FILE_EXPLORER_COMMAND_EVENT = "cortex:file-explorer-command"

export const FILE_EXPLORER_COMMAND_IDS = {
	openMenu: "file-explorer.open-menu",
	rename: "file-explorer.rename",
	delete: "file-explorer.delete",
} as const

export type FileExplorerCommandId =
	(typeof FILE_EXPLORER_COMMAND_IDS)[keyof typeof FILE_EXPLORER_COMMAND_IDS]

export interface FileExplorerCommandEventDetail {
	commandId: FileExplorerCommandId
}

export function dispatchFileExplorerCommand(commandId: FileExplorerCommandId): void {
	window.dispatchEvent(
		new CustomEvent<FileExplorerCommandEventDetail>(FILE_EXPLORER_COMMAND_EVENT, {
			detail: { commandId },
		}),
	)
}
