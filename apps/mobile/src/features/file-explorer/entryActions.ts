import { executeCommand } from "@cortex/commands"
import {
	type FileEntryActionId,
	getEditableEntryName,
	getEntryNameKind,
	getErrorMessage,
	getFileEntryActions,
	getMoveDestinations,
	type MoveDestination,
	toEntryFileName,
	useVaultStore,
	validateEntryName,
} from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { getParentPath, normalizePath } from "@cortex/platform/utils"
import type { PluginContextMenuAction } from "@cortex/plugin-host-core"
import { ActionSheetIOS, Alert, Platform } from "react-native"

import type { MenuGroup, MenuItem } from "@/components/ui/menuTypes"
import type { SymbolName } from "@/components/ui/Symbol"
import { toast } from "@/features/feedback/useToast"
import { showEntryMenu } from "@/features/file-explorer/entryMenuStore"
import {
	openTextPrompt,
	submitTextPrompt,
	type TextPromptRequest,
} from "@/features/file-explorer/textPromptStore"
import { getVaultDisplayName } from "@/features/file-explorer/vaultDisplayName"
import { triggerDeleteHaptic, triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const MENU_DISMISS_DELAY = 350

const ENTRY_ACTION_ICONS: Record<FileEntryActionId, SymbolName> = {
	delete: { sf: "trash", md: "delete" },
	duplicate: { sf: "plus.square.on.square", md: "content_copy" },
	move: { sf: "folder", md: "drive_file_move" },
	rename: { sf: "pencil", md: "edit" },
}

const PLUGIN_ACTION_ICON: SymbolName = { sf: "puzzlepiece.extension", md: "extension" }
const FOLDER_ICON: SymbolName = { sf: "folder", md: "folder" }

function afterMenuDismiss(action: () => void): void {
	if (IS_IOS) setTimeout(action, MENU_DISMISS_DELAY)
	else action()
}

function presentIosPrompt(request: TextPromptRequest, value: string): void {
	Alert.prompt(
		request.title,
		request.message,
		[
			{ style: "cancel", text: "Cancel" },
			{
				isPreferred: true,
				onPress: (text?: string) => void submitIosPrompt(request, text ?? ""),
				text: request.confirmLabel,
			},
		],
		"plain-text",
		value,
	)
}

async function submitIosPrompt(request: TextPromptRequest, value: string): Promise<void> {
	const error = await submitTextPrompt(request, value)
	if (!error) return
	Alert.alert(error, undefined, [{ onPress: () => presentIosPrompt(request, value), text: "OK" }])
}

export function promptText(request: TextPromptRequest): void {
	if (IS_IOS) presentIosPrompt(request, request.initialValue ?? "")
	else openTextPrompt(request)
}

function siblingExists(parentPath: string, name: string): boolean {
	const parent = normalizePath(parentPath)
	const lower = name.toLocaleLowerCase()
	return useVaultStore
		.getState()
		.files.some(
			(file) =>
				normalizePath(getParentPath(file.path)) === parent &&
				file.name.toLocaleLowerCase() === lower,
		)
}

export function promptNewFolder(parentPath: string): void {
	triggerSelectionHaptic()
	promptText({
		confirmLabel: "Create",
		placeholder: "Folder name",
		submit: async (value) => {
			await useVaultStore.getState().createFolder(parentPath, value)
			toast(`Created ${value}`)
		},
		title: "New folder",
		validate: (value) =>
			validateEntryName("folder", value) ??
			(siblingExists(parentPath, value) ? `A folder named ${value} already exists here.` : null),
	})
}

export function renameEntry(entry: FileEntry): void {
	const kind = getEntryNameKind(entry)
	promptText({
		confirmLabel: "Rename",
		initialValue: getEditableEntryName(entry),
		placeholder: entry.isDir ? "Folder name" : "Note title",
		submit: async (value) => {
			await useVaultStore.getState().renameFile(entry.path, toEntryFileName(kind, value))
		},
		title: entry.isDir ? "Rename folder" : "Rename note",
		validate: (value) => validateEntryName(kind, value),
	})
}

async function moveEntryTo(entry: FileEntry, destination: MoveDestination): Promise<void> {
	triggerSelectionHaptic()
	try {
		await useVaultStore.getState().moveFile(entry.path, destination.path)
		toast(`Moved to ${destination.label}`)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function moveEntry(entry: FileEntry): void {
	const { files, vault } = useVaultStore.getState()
	const destinations = getMoveDestinations(
		files,
		entry,
		vault ? { name: getVaultDisplayName(), path: vault.path } : null,
	)
	if (destinations.length === 0) {
		toast("There is no other folder to move to")
		return
	}
	const title = `Move "${getEditableEntryName(entry)}" to`
	if (IS_IOS) {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				cancelButtonIndex: destinations.length,
				options: [...destinations.map((destination) => destination.label), "Cancel"],
				title,
			},
			(index) => {
				const destination = destinations[index]
				if (destination) void moveEntryTo(entry, destination)
			},
		)
		return
	}
	showEntryMenu({
		groups: [
			destinations.map((destination) => ({
				icon: FOLDER_ICON,
				key: destination.path,
				label: destination.label,
				onPress: () => void moveEntryTo(entry, destination),
			})),
		],
		header: title,
	})
}

function runEntryAction(entry: FileEntry, id: FileEntryActionId, run: () => void): void {
	switch (id) {
		case "rename":
			afterMenuDismiss(() => renameEntry(entry))
			return
		case "move":
			afterMenuDismiss(() => moveEntry(entry))
			return
		case "delete":
			triggerDeleteHaptic()
			afterMenuDismiss(run)
			return
		case "duplicate":
			triggerSelectionHaptic()
			run()
	}
}

export function buildEntryMenuGroups(
	entry: FileEntry,
	pluginActions: readonly PluginContextMenuAction[],
	onNavigate?: () => void,
): MenuGroup[] {
	const actions = getFileEntryActions({ filePath: entry.path, isDirectory: entry.isDir }).filter(
		(action) => action.visible,
	)
	const toItem = (action: (typeof actions)[number]): MenuItem => ({
		destructive: action.destructive,
		icon: ENTRY_ACTION_ICONS[action.id],
		key: action.id,
		label: action.label,
		onPress: () =>
			runEntryAction(entry, action.id, () => {
				if (action.id === "duplicate") onNavigate?.()
				executeCommand(action.commandId, { payload: action.payload, source: "menu" })
			}),
	})
	const groups: MenuGroup[] = [
		actions.filter((action) => !action.destructive).map(toItem),
		pluginActions.map((action) => ({
			icon: PLUGIN_ACTION_ICON,
			key: action.key,
			label: action.label,
			onPress: () => afterMenuDismiss(action.run),
		})),
		actions.filter((action) => action.destructive).map(toItem),
	]
	return groups.filter((group) => group.length > 0)
}
