import type { CommandEntry, CommandExecutionContext } from "@cortex/commands"
import {
	convertFolderToDatabase,
	getBaseName,
	removeDatabase,
	reportAppError,
	useDatabaseStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Table2Icon } from "lucide-react"
import { openDatabaseView } from "./databaseWorkspace"
import { newDatabaseModal } from "./newDatabaseModal"

export const DATABASE_COMMAND_IDS = {
	create: "database.new",
	open: "database.open",
	convertFolder: "database.convert-folder",
	remove: "database.remove",
} as const

function getFolderPayload(context: CommandExecutionContext): string | null {
	const payload = context.payload
	if (!payload || typeof payload !== "object") return null
	const value = (payload as Record<string, unknown>).filePath
	return typeof value === "string" ? value : null
}

async function convertFolder(folderPath: string): Promise<void> {
	try {
		await convertFolderToDatabase(folderPath)
		openDatabaseView(folderPath)
	} catch (error) {
		await reportAppError({
			operation: "database.convert-folder",
			source: "databases",
			cause: error,
			userMessage: "The folder could not be turned into a database.",
			context: { folderPath },
		})
	}
}

async function confirmRemoveDatabase(folderPath: string): Promise<void> {
	const confirmed = await getPlatform().dialog.showConfirm({
		title: "Turn back into a folder?",
		message: `Views for "${getBaseName(folderPath)}" will be removed. Its notes stay where they are.`,
		confirmLabel: "Remove views",
		cancelLabel: "Cancel",
		destructive: true,
		kind: "warning",
	})
	if (!confirmed) return
	try {
		await removeDatabase(folderPath)
	} catch (error) {
		await reportAppError({
			operation: "database.remove",
			source: "databases",
			cause: error,
			userMessage: "The database views could not be removed.",
			context: { folderPath },
		})
	}
}

export function createDatabaseCommandEntries(): CommandEntry[] {
	return [
		{
			id: DATABASE_COMMAND_IDS.create,
			label: "New Database",
			category: "File",
			aliases: ["new-database", "database"],
			icon: Table2Icon,
			hotkey: { defaultKeys: "mod+shift+d", scope: "global" },
			execute: (context) => {
				if (!useVaultStore.getState().vault) return
				newDatabaseModal.open({ parentPath: getFolderPayload(context), mode: "create" })
			},
		},
		{
			id: DATABASE_COMMAND_IDS.open,
			label: "Open Database",
			category: "File",
			aliases: ["open-database"],
			icon: Table2Icon,
			execute: (context) => {
				const folderPath = getFolderPayload(context)
				if (folderPath) openDatabaseView(folderPath)
			},
		},
		{
			id: DATABASE_COMMAND_IDS.convertFolder,
			label: "Turn Folder into Database",
			category: "File",
			aliases: ["convert-folder-database"],
			execute: (context) => {
				const folderPath = getFolderPayload(context)
				if (folderPath) void convertFolder(folderPath)
				else if (useVaultStore.getState().vault) {
					newDatabaseModal.open({ parentPath: null, mode: "convert" })
				}
			},
		},
		{
			id: DATABASE_COMMAND_IDS.remove,
			label: "Remove Database Views",
			category: "File",
			execute: (context) => {
				const folderPath = getFolderPayload(context)
				if (folderPath && useDatabaseStore.getState().databases[folderPath]) {
					void confirmRemoveDatabase(folderPath)
				}
			},
		},
	]
}
