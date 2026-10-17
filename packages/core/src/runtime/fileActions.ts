import type { CommandEntry, CommandExecutionContext } from "@cortex/commands"
import { getPlatform } from "@cortex/platform"
import { getBaseName, getParentPath, isMarkdownPath } from "@cortex/platform/utils"
import { canWriteVaultPath, canWriteVaultTree } from "../stores/accessStore"
import { useEditorStore } from "../stores/editorStore"
import { getVaultIndex, useVaultStore } from "../stores/vaultStore"
import { reportAppError } from "../utils/reportAppError"

export interface FileCommandHost {
	openFile: (filePath: string) => void
}

export interface FileEntryActionTarget {
	filePath: string
	isDirectory: boolean
}

export type FileEntryActionId = "rename" | "move" | "duplicate" | "delete"

export interface FileEntryAction {
	id: FileEntryActionId
	commandId: string
	label: string
	destructive: boolean
	payload: { filePath: string }
	visible: boolean
}

export const FILE_COMMAND_IDS = {
	newNote: "file.new",
	duplicate: "file.duplicate",
	delete: "file.delete",
	rename: "file-explorer.rename",
	move: "file-explorer.move",
	dailyNote: "navigate.daily-note",
} as const

function getPayloadString(context: CommandExecutionContext, key: string): string | null {
	const payload = context.payload
	if (!payload || typeof payload !== "object") return null
	const value = (payload as Record<string, unknown>)[key]
	return typeof value === "string" ? value : null
}

function getTargetFilePath(context: CommandExecutionContext): string | null {
	return getPayloadString(context, "filePath") ?? useEditorStore.getState().activeFilePath
}

export function getFileEntryActions({
	filePath,
	isDirectory,
}: FileEntryActionTarget): FileEntryAction[] {
	const payload = { filePath }
	const isNote = !isDirectory && isMarkdownPath(filePath)
	const writable = canWriteVaultTree(filePath, isDirectory)
	const parentWritable = canWriteVaultPath(getParentPath(filePath), true)
	return [
		{
			id: "rename",
			commandId: FILE_COMMAND_IDS.rename,
			label: "Rename",
			destructive: false,
			payload,
			visible: writable,
		},
		{
			id: "move",
			commandId: FILE_COMMAND_IDS.move,
			label: "Move",
			destructive: false,
			payload,
			visible: writable,
		},
		{
			id: "duplicate",
			commandId: FILE_COMMAND_IDS.duplicate,
			label: "Make a Copy",
			destructive: false,
			payload,
			visible: isNote && parentWritable,
		},
		{
			id: "delete",
			commandId: FILE_COMMAND_IDS.delete,
			label: "Delete",
			destructive: true,
			payload,
			visible: writable,
		},
	]
}

export async function createNote(parentPath?: string, name = "Untitled"): Promise<string | null> {
	const vaultState = useVaultStore.getState()
	const vaultPath = vaultState.vault?.path
	if (!vaultPath) return null
	return await vaultState.createFile(parentPath ?? vaultPath, name)
}

export async function confirmDeleteEntry(filePath: string): Promise<boolean> {
	const isDirectory = getVaultIndex().get(filePath)?.isDir === true
	const confirmed = await getPlatform().dialog.showConfirm({
		title: isDirectory ? "Delete folder?" : "Delete note?",
		message: isDirectory
			? `"${getBaseName(filePath)}" and everything inside it will be deleted from this vault.`
			: `"${getBaseName(filePath)}" will be deleted from this vault.`,
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		destructive: true,
		kind: "warning",
	})
	if (!confirmed) return false
	await useVaultStore.getState().deleteFile(filePath)
	return true
}

async function runFileAction(
	operation: string,
	userMessage: string,
	context: Record<string, string>,
	action: () => Promise<unknown>,
): Promise<void> {
	try {
		await action()
	} catch (error) {
		await reportAppError({ operation, source: "file-actions", cause: error, userMessage, context })
	}
}

export function createFileCommandEntries({ openFile }: FileCommandHost): CommandEntry[] {
	const openIfCreated = (filePath: string | null) => {
		if (filePath) openFile(filePath)
	}
	return [
		{
			id: FILE_COMMAND_IDS.newNote,
			label: "New Note",
			category: "File",
			aliases: ["new-note"],
			icon: "file",
			hotkey: { defaultKeys: "mod+n", scope: "global" },
			execute: (context) => {
				const parentPath = getPayloadString(context, "parentPath") ?? undefined
				return runFileAction("create-new-note", "The note could not be created.", {}, async () =>
					openIfCreated(await createNote(parentPath)),
				)
			},
		},
		{
			id: FILE_COMMAND_IDS.duplicate,
			label: "Make a Copy",
			category: "File",
			aliases: ["duplicate-note", "make-copy"],
			icon: "copy",
			execute: (context) => {
				const filePath = getTargetFilePath(context)
				if (!filePath) return
				return runFileAction(
					"duplicate-file",
					"The note could not be duplicated.",
					{ filePath },
					async () => openFile(await useVaultStore.getState().duplicateFile(filePath)),
				)
			},
		},
		{
			id: FILE_COMMAND_IDS.delete,
			label: "Delete File",
			category: "File",
			aliases: ["delete-note"],
			icon: "trash",
			execute: (context) => {
				const filePath = getTargetFilePath(context)
				if (!filePath) return
				return runFileAction(
					"delete-file-entry",
					`"${getBaseName(filePath)}" could not be deleted.`,
					{ filePath },
					() => confirmDeleteEntry(filePath),
				)
			},
		},
		{
			id: FILE_COMMAND_IDS.dailyNote,
			label: "Open Daily Note",
			category: "Navigate",
			aliases: ["daily-note", "today"],
			icon: "calendar",
			hotkey: { defaultKeys: "mod+d", scope: "global" },
			execute: () =>
				runFileAction("open-daily-note", "The daily note could not be opened.", {}, async () =>
					openIfCreated(await useVaultStore.getState().openDailyNote()),
				),
		},
	]
}
