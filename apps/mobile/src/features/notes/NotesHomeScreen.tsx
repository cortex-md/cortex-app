import {
	getNotePathPresentation,
	getPortableFileNameError,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import type { FileEntry, VaultMetadata } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	BottomSheet,
	Column,
	Button as ExpoButton,
	FieldGroup,
	Host,
	ListItem,
	TextInput,
} from "@expo/ui"
import * as Haptics from "expo-haptics"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react"
import {
	type ColorValue,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	useColorScheme,
	View,
} from "react-native"
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable"

import { createLocalVault } from "@/features/vault/local-vault"
import { getMobileColorScheme, mobileColors } from "@/theme/colors"

type SheetAction =
	| { kind: "create-vault" }
	| { kind: "create-note"; parentPath: string }
	| { kind: "create-folder"; parentPath: string }
	| { kind: "rename"; entry: FileEntry }
	| null

interface NotesUiState {
	createActionsPresented: boolean
	entryActionsEntry: FileEntry | null
	moveEntry: FileEntry | null
	moveError: string | null
	refreshing: boolean
	sheetAction: SheetAction
	sheetError: string | null
	submitting: boolean
}

type NotesUiAction =
	| { type: "set-refreshing"; refreshing: boolean }
	| { type: "show-create-actions"; presented: boolean }
	| { type: "show-entry-actions"; entry: FileEntry | null }
	| { type: "show-move"; entry: FileEntry | null }
	| { type: "set-move-error"; error: string | null }
	| { type: "show-text-sheet"; action: SheetAction }
	| { type: "set-sheet-error"; error: string | null }
	| { type: "set-submitting"; submitting: boolean }
	| { type: "dismiss-text-sheet" }
	| { type: "dismiss-move-sheet" }

interface TextActionSheetProps {
	action: SheetAction
	error: string | null
	initialValue: string
	onDismiss: () => void
	onSubmit: (value: string) => void
	submitting: boolean
}

interface CreateActionsSheetProps {
	isPresented: boolean
	onCreateFolder: () => void
	onCreateNote: () => void
	onCreateVault: () => void
	onDismiss: () => void
}

interface EntryActionsSheetProps {
	entry: FileEntry | null
	onDelete: (entry: FileEntry) => void
	onDismiss: () => void
	onDuplicate: (entry: FileEntry) => void
	onMove: (entry: FileEntry) => void
	onRename: (entry: FileEntry) => void
}

interface MoveDestination {
	label: string
	path: string
}

interface MoveEntrySheetProps {
	destinations: MoveDestination[]
	entry: FileEntry | null
	error: string | null
	onDismiss: () => void
	onMove: (targetParentPath: string) => void
	submitting: boolean
	textColor: ColorValue
}

interface NotesListProps {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	entries: FileEntry[]
	error: string | null
	loading: boolean
	onDeleteEntry: (entry: FileEntry) => void
	onDuplicateEntry: (entry: FileEntry) => void
	onOpenFolder: (folderPath: string) => void
	onOpenNote: (filePath: string) => void
	onRefresh: () => void
	onRenameEntry: (entry: FileEntry) => void
	onShowEntryActions: (entry: FileEntry) => void
	refreshing: boolean
	vault: VaultMetadata | null
}

const initialNotesUiState: NotesUiState = {
	createActionsPresented: false,
	entryActionsEntry: null,
	moveEntry: null,
	moveError: null,
	refreshing: false,
	sheetAction: null,
	sheetError: null,
	submitting: false,
}

function notesUiReducer(state: NotesUiState, action: NotesUiAction): NotesUiState {
	switch (action.type) {
		case "set-refreshing":
			return { ...state, refreshing: action.refreshing }
		case "show-create-actions":
			return { ...state, createActionsPresented: action.presented }
		case "show-entry-actions":
			return { ...state, entryActionsEntry: action.entry }
		case "show-move":
			return { ...state, entryActionsEntry: null, moveEntry: action.entry, moveError: null }
		case "set-move-error":
			return { ...state, moveError: action.error }
		case "show-text-sheet":
			return {
				...state,
				createActionsPresented: false,
				entryActionsEntry: null,
				sheetAction: action.action,
				sheetError: null,
			}
		case "set-sheet-error":
			return { ...state, sheetError: action.error }
		case "set-submitting":
			return { ...state, submitting: action.submitting }
		case "dismiss-text-sheet":
			if (state.submitting) return state
			return { ...state, sheetAction: null, sheetError: null }
		case "dismiss-move-sheet":
			if (state.submitting) return state
			return { ...state, moveEntry: null, moveError: null }
	}
}

function getParamValue(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
}

function getParentPath(path: string): string {
	const normalizedPath = path.replace(/\/+$/u, "")
	return normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
}

function getFileName(path: string): string {
	return path.split("/").pop() ?? path
}

function isPathOrDescendant(path: string, parentPath: string): boolean {
	return path === parentPath || path.startsWith(`${parentPath}/`)
}

function isMarkdownEntry(entry: FileEntry): boolean {
	return !entry.isDir && entry.name.toLowerCase().endsWith(".md")
}

function getNoteInputName(entry: FileEntry): string {
	if (entry.isDir) return entry.name
	return entry.name.replace(/\.md$/iu, "")
}

function getEntryTitle(entry: FileEntry, vaultPath?: string): string {
	if (entry.isDir) return entry.name
	return getNotePathPresentation(entry.path, vaultPath).title || entry.name
}

function triggerSelectionHaptic(): void {
	void Haptics.selectionAsync().catch(() => {})
}

function triggerDeleteHaptic(): void {
	void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
}

function getSheetTitle(action: SheetAction): string {
	switch (action?.kind) {
		case "create-vault":
			return "New vault"
		case "create-note":
			return "New note"
		case "create-folder":
			return "New folder"
		case "rename":
			return action.entry.isDir ? "Rename folder" : "Rename note"
		default:
			return ""
	}
}

function getSheetPlaceholder(action: SheetAction): string {
	switch (action?.kind) {
		case "create-vault":
			return "Personal"
		case "create-note":
			return "Untitled"
		case "create-folder":
			return "Research"
		case "rename":
			return action.entry.isDir ? "Folder name" : "Note title"
		default:
			return ""
	}
}

function getSheetDescription(action: SheetAction): string {
	switch (action?.kind) {
		case "create-vault":
			return "Stored inside the Cortex app sandbox."
		case "create-note":
			return "Creates a Markdown note in the current folder."
		case "create-folder":
			return "Creates a folder in the current vault."
		case "rename":
			return "Renames through the shared Cortex vault store."
		default:
			return ""
	}
}

function validateActionName(action: SheetAction, value: string): string | null {
	const trimmedValue = value.trim()
	if (action?.kind === "create-vault") {
		return trimmedValue ? null : "Vault name cannot be empty"
	}

	if (action?.kind === "create-note") {
		return getPortableFileNameError(
			trimmedValue.endsWith(".md") ? trimmedValue : `${trimmedValue}.md`,
		)
	}

	if (action?.kind === "create-folder") {
		return getPortableFileNameError(trimmedValue)
	}

	if (action?.kind === "rename") {
		const fileName = action.entry.isDir
			? trimmedValue
			: trimmedValue.endsWith(".md")
				? trimmedValue
				: `${trimmedValue}.md`
		return getPortableFileNameError(fileName)
	}

	return null
}

function TextActionSheet({
	action,
	error,
	initialValue,
	onDismiss,
	onSubmit,
	submitting,
}: TextActionSheetProps) {
	const draftRef = useRef(initialValue)
	const isPresented = action !== null
	const title = getSheetTitle(action)
	const [validationError, setValidationError] = useState<string | null>(null)

	function handleSubmit() {
		const nextValue = draftRef.current.trim()
		const nextValidationError = validateActionName(action, nextValue)
		if (nextValidationError) {
			setValidationError(nextValidationError)
			return
		}

		onSubmit(nextValue)
	}

	return (
		<Host>
			<BottomSheet isPresented={isPresented} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={12} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title={title}>
							<ListItem supportingText={validationError ?? error ?? getSheetDescription(action)}>
								{title}
							</ListItem>
							<TextInput
								autoCapitalize="sentences"
								autoCorrect={false}
								autoFocus
								defaultValue={initialValue}
								onChangeText={(value) => {
									draftRef.current = value
								}}
								onSubmitEditing={(value) => {
									draftRef.current = value
									handleSubmit()
								}}
								placeholder={getSheetPlaceholder(action)}
								returnKeyType="done"
							/>
						</FieldGroup.Section>
					</FieldGroup>
					<ExpoButton
						disabled={submitting}
						label={submitting ? "Working..." : "Done"}
						onPress={handleSubmit}
					/>
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

function CreateActionsSheet({
	isPresented,
	onCreateFolder,
	onCreateNote,
	onCreateVault,
	onDismiss,
}: CreateActionsSheetProps) {
	return (
		<Host>
			<BottomSheet isPresented={isPresented} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={10} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title="Create">
							<ListItem supportingText="Add content to this local sandbox vault.">
								New item
							</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<ExpoButton label="New note" onPress={onCreateNote} />
					<ExpoButton label="New folder" onPress={onCreateFolder} variant="outlined" />
					<ExpoButton label="New vault" onPress={onCreateVault} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

function EntryActionsSheet({
	entry,
	onDelete,
	onDismiss,
	onDuplicate,
	onMove,
	onRename,
}: EntryActionsSheetProps) {
	return (
		<Host>
			<BottomSheet isPresented={entry !== null} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={10} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title={entry?.isDir ? "Folder actions" : "Note actions"}>
							<ListItem supportingText={entry?.path ?? ""}>{entry?.name ?? ""}</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<ExpoButton
						label="Rename"
						onPress={() => {
							if (entry) onRename(entry)
						}}
					/>
					<ExpoButton
						label="Move"
						onPress={() => {
							if (entry) onMove(entry)
						}}
						variant="outlined"
					/>
					{entry && isMarkdownEntry(entry) ? (
						<ExpoButton
							label="Duplicate"
							onPress={() => {
								onDuplicate(entry)
							}}
							variant="outlined"
						/>
					) : null}
					<ExpoButton
						label="Delete"
						onPress={() => {
							if (entry) onDelete(entry)
						}}
						variant="outlined"
					/>
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

function MoveEntrySheet({
	destinations,
	entry,
	error,
	onDismiss,
	onMove,
	submitting,
	textColor,
}: MoveEntrySheetProps) {
	const currentParentPath = entry ? getParentPath(entry.path) : null
	function renderDestination({ item }: { item: MoveDestination }) {
		return (
			<MoveDestinationRow
				disabled={submitting || currentParentPath === item.path}
				label={item.label}
				onMove={onMove}
				path={item.path}
				textColor={textColor}
			/>
		)
	}

	return (
		<Host>
			<BottomSheet isPresented={entry !== null} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={12} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title="Move to">
							<ListItem supportingText={error ?? "Choose a destination folder."}>
								{entry?.name ?? "Move"}
							</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<FlatList
						data={destinations}
						keyExtractor={(destination) => destination.path}
						renderItem={renderDestination}
						style={styles.moveList}
					/>
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

function MoveDestinationRow({
	disabled,
	label,
	onMove,
	path,
	textColor,
}: {
	disabled: boolean
	label: string
	onMove: (targetParentPath: string) => void
	path: string
	textColor: ColorValue
}) {
	return (
		<Pressable
			disabled={disabled}
			onPress={() => onMove(path)}
			style={({ pressed }) => [
				styles.moveDestination,
				{
					opacity: disabled ? 0.42 : pressed ? 0.58 : 1,
				},
			]}
		>
			<Text numberOfLines={1} style={[styles.moveDestinationText, { color: textColor }]}>
				{label}
			</Text>
		</Pressable>
	)
}

function NotesList({
	colors,
	entries,
	error,
	loading,
	onDeleteEntry,
	onDuplicateEntry,
	onOpenFolder,
	onOpenNote,
	onRefresh,
	onRenameEntry,
	onShowEntryActions,
	refreshing,
	vault,
}: NotesListProps) {
	function renderEntry({ item }: { item: FileEntry }) {
		return (
			<NoteRow
				colors={colors}
				entry={item}
				onDeleteEntry={onDeleteEntry}
				onDuplicateEntry={onDuplicateEntry}
				onOpenFolder={onOpenFolder}
				onOpenNote={onOpenNote}
				onRenameEntry={onRenameEntry}
				onShowEntryActions={onShowEntryActions}
				vaultPath={vault?.path}
			/>
		)
	}

	return (
		<FlatList
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			data={entries}
			keyExtractor={(item) => item.path}
			ListEmptyComponent={() => <NotesEmptyState colors={colors} vault={vault} />}
			ListHeaderComponent={() => <NotesListHeader colors={colors} error={error} vault={vault} />}
			onRefresh={onRefresh}
			refreshing={refreshing || loading}
			renderItem={renderEntry}
		/>
	)
}

function NotesListHeader({
	colors,
	error,
	vault,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	error: string | null
	vault: VaultMetadata | null
}) {
	return (
		<View style={styles.header}>
			<Text style={[styles.eyebrow, { color: colors.secondaryLabel }]}>
				{vault ? "Local vault" : "Cortex Mobile"}
			</Text>
			{error ? (
				<Text selectable style={[styles.errorText, { color: colors.destructive }]}>
					{error}
				</Text>
			) : null}
		</View>
	)
}

function NotesEmptyState({
	colors,
	vault,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	vault: VaultMetadata | null
}) {
	return (
		<View style={styles.emptyState}>
			<Text selectable style={[styles.emptyTitle, { color: colors.label }]}>
				{vault ? "No notes here" : "No vault open"}
			</Text>
			<Text selectable style={[styles.emptyBody, { color: colors.secondaryLabel }]}>
				{vault
					? "Create a note or folder in this local vault."
					: "Create a sandboxed vault to start using Cortex Mobile."}
			</Text>
		</View>
	)
}

function NoteRow({
	colors,
	entry,
	onDeleteEntry,
	onDuplicateEntry,
	onOpenFolder,
	onOpenNote,
	onRenameEntry,
	onShowEntryActions,
	vaultPath,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	entry: FileEntry
	onDeleteEntry: (entry: FileEntry) => void
	onDuplicateEntry: (entry: FileEntry) => void
	onOpenFolder: (folderPath: string) => void
	onOpenNote: (filePath: string) => void
	onRenameEntry: (entry: FileEntry) => void
	onShowEntryActions: (entry: FileEntry) => void
	vaultPath?: string
}) {
	const title = getEntryTitle(entry, vaultPath)
	const supportingText = entry.isDir ? "Folder" : "Markdown note"

	return (
		<Swipeable
			friction={1.5}
			overshootRight={false}
			renderRightActions={() => (
				<NoteRowSwipeActions
					colors={colors}
					entry={entry}
					onDeleteEntry={onDeleteEntry}
					onDuplicateEntry={onDuplicateEntry}
					onRenameEntry={onRenameEntry}
				/>
			)}
			rightThreshold={48}
		>
			<Pressable
				onLongPress={() => onShowEntryActions(entry)}
				onPress={() => {
					if (entry.isDir) {
						onOpenFolder(entry.path)
						return
					}

					onOpenNote(entry.path)
				}}
				style={({ pressed }) => [
					styles.row,
					{
						backgroundColor: colors.secondaryBackground,
						borderColor: colors.separator,
						opacity: pressed ? 0.68 : 1,
					},
				]}
			>
				<View style={styles.rowText}>
					<Text numberOfLines={1} style={[styles.rowTitle, { color: colors.label }]}>
						{title}
					</Text>
					<Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.secondaryLabel }]}>
						{supportingText}
					</Text>
				</View>
				<Text style={[styles.rowChevron, { color: colors.secondaryLabel }]}>
					{entry.isDir ? "›" : ""}
				</Text>
			</Pressable>
		</Swipeable>
	)
}

function NoteRowSwipeActions({
	colors,
	entry,
	onDeleteEntry,
	onDuplicateEntry,
	onRenameEntry,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	entry: FileEntry
	onDeleteEntry: (entry: FileEntry) => void
	onDuplicateEntry: (entry: FileEntry) => void
	onRenameEntry: (entry: FileEntry) => void
}) {
	return (
		<View style={styles.swipeActions}>
			{isMarkdownEntry(entry) ? (
				<Pressable
					onPress={() => onDuplicateEntry(entry)}
					style={[styles.swipeAction, { backgroundColor: colors.tint }]}
				>
					<Text style={styles.swipeActionText}>Duplicate</Text>
				</Pressable>
			) : null}
			<Pressable
				onPress={() => onRenameEntry(entry)}
				style={[styles.swipeAction, { backgroundColor: colors.secondaryLabel }]}
			>
				<Text style={styles.swipeActionText}>Rename</Text>
			</Pressable>
			<Pressable
				onPress={() => onDeleteEntry(entry)}
				style={[styles.swipeAction, { backgroundColor: colors.destructive }]}
			>
				<Text style={styles.swipeActionText}>Delete</Text>
			</Pressable>
		</View>
	)
}

function buildMoveDestinations(
	files: FileEntry[],
	moveEntry: FileEntry | null,
	vault: VaultMetadata | null,
): MoveDestination[] {
	if (!moveEntry || !vault) return []
	const destinations: MoveDestination[] = [{ label: vault.name, path: vault.path }]
	for (const file of files) {
		if (!file.isDir) continue
		if (file.path === vault.path) continue
		if (moveEntry.isDir && isPathOrDescendant(file.path, moveEntry.path)) continue
		destinations.push({ label: file.name, path: file.path })
	}
	return destinations
}

function useNotesHomeController() {
	const router = useRouter()
	const params = useLocalSearchParams<{ folderPath?: string | string[] }>()
	const requestedFolderPath = getParamValue(params.folderPath)
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const loading = useVaultStore((state) => state.loading)
	const error = useVaultStore((state) => state.error)
	const pendingOnboardingNotePath = useVaultStore((state) => state.pendingOnboardingNotePath)
	const openVault = useVaultStore((state) => state.openVault)
	const createFile = useVaultStore((state) => state.createFile)
	const createFolder = useVaultStore((state) => state.createFolder)
	const deleteFile = useVaultStore((state) => state.deleteFile)
	const renameFile = useVaultStore((state) => state.renameFile)
	const moveFile = useVaultStore((state) => state.moveFile)
	const duplicateFile = useVaultStore((state) => state.duplicateFile)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const clearPendingOnboardingNotePath = useVaultStore(
		(state) => state.clearPendingOnboardingNotePath,
	)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const setActiveFile = useEditorStore((state) => state.setActiveFile)
	const [uiState, dispatch] = useReducer(notesUiReducer, initialNotesUiState)
	const openPendingOnboardingNote = useEffectEvent((filePath: string) => {
		openTab(filePath, { reuseActive: true })
		setActiveFile(filePath)
		router.push({
			params: { filePath },
			pathname: "/note",
		})
	})

	const selectedFolderStillExists = Boolean(
		vault &&
			requestedFolderPath &&
			(requestedFolderPath === vault.path ||
				files.some((file) => file.isDir && file.path === requestedFolderPath)),
	)
	const effectiveCurrentFolderPath = vault
		? selectedFolderStillExists
			? requestedFolderPath
			: vault.path
		: null
	const visibleEntries = effectiveCurrentFolderPath
		? files.filter((file) => getParentPath(file.path) === effectiveCurrentFolderPath)
		: []
	const moveDestinations = buildMoveDestinations(files, uiState.moveEntry, vault)
	const currentFolderTitle =
		vault && effectiveCurrentFolderPath && effectiveCurrentFolderPath !== vault.path
			? getFileName(effectiveCurrentFolderPath)
			: (vault?.name ?? "Notes")
	const sheetInitialValue =
		uiState.sheetAction?.kind === "rename"
			? getNoteInputName(uiState.sheetAction.entry)
			: uiState.sheetAction?.kind === "create-vault"
				? "Personal"
				: ""

	function openNote(filePath: string) {
		openTab(filePath, { reuseActive: true })
		setActiveFile(filePath)
		router.push({
			params: { filePath },
			pathname: "/note",
		})
	}

	useEffect(() => {
		if (!pendingOnboardingNotePath) return
		openPendingOnboardingNote(pendingOnboardingNotePath)
		clearPendingOnboardingNotePath()
	}, [clearPendingOnboardingNotePath, pendingOnboardingNotePath])

	function handleRefresh() {
		if (!vault) return
		dispatch({ refreshing: true, type: "set-refreshing" })
		void refreshFiles().finally(() => dispatch({ refreshing: false, type: "set-refreshing" }))
	}

	function handleOpenFolder(folderPath: string) {
		triggerSelectionHaptic()
		router.push({
			params: { folderPath },
			pathname: "/folder" as never,
		})
	}

	function handleSubmitSheet(value: string) {
		if (!uiState.sheetAction) return
		dispatch({ submitting: true, type: "set-submitting" })
		dispatch({ error: null, type: "set-sheet-error" })

		const actionPromise = (async () => {
			switch (uiState.sheetAction?.kind) {
				case "create-vault": {
					const createdVault = await createLocalVault(value)
					await openVault(createdVault.path, {
						createOnboardingNote: true,
						name: createdVault.name,
					})
					router.replace("/")
					break
				}
				case "create-note": {
					const filePath = await createFile(uiState.sheetAction.parentPath, value)
					openNote(filePath)
					break
				}
				case "create-folder": {
					await createFolder(uiState.sheetAction.parentPath, value)
					break
				}
				case "rename": {
					const nextName = uiState.sheetAction.entry.isDir
						? value
						: value.endsWith(".md")
							? value
							: `${value}.md`
					const renamedPath = await renameFile(uiState.sheetAction.entry.path, nextName)
					if (requestedFolderPath === uiState.sheetAction.entry.path) {
						router.replace({
							params: { folderPath: renamedPath },
							pathname: "/folder" as never,
						})
					}
					break
				}
			}
		})()

		void actionPromise
			.then(() => {
				dispatch({ submitting: false, type: "set-submitting" })
				dispatch({ type: "dismiss-text-sheet" })
			})
			.catch((submitError) => {
				dispatch({
					error: submitError instanceof Error ? submitError.message : String(submitError),
					type: "set-sheet-error",
				})
			})
			.finally(() => dispatch({ submitting: false, type: "set-submitting" }))
	}

	async function handleDeleteEntry(entry: FileEntry) {
		triggerDeleteHaptic()
		const confirmed = await getPlatform().dialog.showConfirm({
			cancelLabel: "Cancel",
			confirmLabel: "Delete",
			destructive: true,
			message: entry.isDir
				? "This deletes the folder and every note inside it from the local sandbox."
				: "This deletes the note from the local sandbox.",
			title: entry.isDir ? "Delete folder?" : "Delete note?",
		})

		if (!confirmed) return
		await deleteFile(entry.path)
		dispatch({ entry: null, type: "show-entry-actions" })
		if (requestedFolderPath && entry.isDir && isPathOrDescendant(requestedFolderPath, entry.path)) {
			router.replace("/")
		}
	}

	function handleDuplicateEntry(entry: FileEntry) {
		if (!isMarkdownEntry(entry)) return
		triggerSelectionHaptic()
		dispatch({ entry: null, type: "show-entry-actions" })
		void duplicateFile(entry.path)
			.then(openNote)
			.catch((duplicateError) => {
				dispatch({
					error: duplicateError instanceof Error ? duplicateError.message : String(duplicateError),
					type: "set-sheet-error",
				})
			})
	}

	function handleMoveEntry(targetParentPath: string) {
		const entry = uiState.moveEntry
		if (!entry) return
		triggerSelectionHaptic()
		dispatch({ submitting: true, type: "set-submitting" })
		dispatch({ error: null, type: "set-move-error" })
		void moveFile(entry.path, targetParentPath)
			.then((newPath) => {
				dispatch({ submitting: false, type: "set-submitting" })
				dispatch({ type: "dismiss-move-sheet" })
				if (
					requestedFolderPath &&
					entry.isDir &&
					isPathOrDescendant(requestedFolderPath, entry.path)
				) {
					router.replace({
						params: { folderPath: newPath },
						pathname: "/folder" as never,
					})
				}
			})
			.catch((moveSubmitError) => {
				dispatch({
					error:
						moveSubmitError instanceof Error ? moveSubmitError.message : String(moveSubmitError),
					type: "set-move-error",
				})
			})
			.finally(() => dispatch({ submitting: false, type: "set-submitting" }))
	}

	function handleCreateFromHeader() {
		triggerSelectionHaptic()
		if (!vault || !effectiveCurrentFolderPath) {
			dispatch({ action: { kind: "create-vault" }, type: "show-text-sheet" })
			return
		}
		dispatch({ presented: true, type: "show-create-actions" })
	}

	return {
		colors,
		currentFolderTitle,
		dispatch,
		effectiveCurrentFolderPath,
		error,
		handleCreateFromHeader,
		handleDeleteEntry,
		handleDuplicateEntry,
		handleMoveEntry,
		handleOpenFolder,
		handleRefresh,
		handleSubmitSheet,
		loading,
		moveDestinations,
		openNote,
		sheetInitialValue,
		uiState,
		vault,
		visibleEntries,
	}
}

export default function NotesHomeScreen() {
	const controller = useNotesHomeController()

	return (
		<View
			style={[styles.root, { backgroundColor: controller.colors.background }]}
			collapsable={false}
		>
			<Stack.Screen
				options={{
					headerLargeTitle: true,
					headerRight: () => (
						<Pressable
							hitSlop={8}
							onPress={controller.handleCreateFromHeader}
							style={({ pressed }) => [{ opacity: pressed ? 0.52 : 1 }, styles.headerButton]}
						>
							<Text style={[styles.headerButtonText, { color: controller.colors.tint }]}>New</Text>
						</Pressable>
					),
					title: controller.currentFolderTitle,
				}}
			/>
			<NotesList
				colors={controller.colors}
				entries={controller.visibleEntries}
				error={controller.error}
				loading={controller.loading}
				onDeleteEntry={(entry) => {
					void controller.handleDeleteEntry(entry)
				}}
				onDuplicateEntry={controller.handleDuplicateEntry}
				onOpenFolder={controller.handleOpenFolder}
				onOpenNote={controller.openNote}
				onRefresh={controller.handleRefresh}
				onRenameEntry={(entry) =>
					controller.dispatch({ action: { entry, kind: "rename" }, type: "show-text-sheet" })
				}
				onShowEntryActions={(entry) => {
					triggerSelectionHaptic()
					controller.dispatch({ entry, type: "show-entry-actions" })
				}}
				refreshing={controller.uiState.refreshing}
				vault={controller.vault}
			/>
			<CreateActionsSheet
				isPresented={controller.uiState.createActionsPresented}
				onCreateFolder={() => {
					if (controller.effectiveCurrentFolderPath) {
						controller.dispatch({
							action: { kind: "create-folder", parentPath: controller.effectiveCurrentFolderPath },
							type: "show-text-sheet",
						})
					}
				}}
				onCreateNote={() => {
					if (controller.effectiveCurrentFolderPath) {
						controller.dispatch({
							action: { kind: "create-note", parentPath: controller.effectiveCurrentFolderPath },
							type: "show-text-sheet",
						})
					}
				}}
				onCreateVault={() =>
					controller.dispatch({ action: { kind: "create-vault" }, type: "show-text-sheet" })
				}
				onDismiss={() => controller.dispatch({ presented: false, type: "show-create-actions" })}
			/>
			<EntryActionsSheet
				entry={controller.uiState.entryActionsEntry}
				onDelete={(entry) => {
					void controller.handleDeleteEntry(entry)
				}}
				onDismiss={() => controller.dispatch({ entry: null, type: "show-entry-actions" })}
				onDuplicate={controller.handleDuplicateEntry}
				onMove={(entry) => controller.dispatch({ entry, type: "show-move" })}
				onRename={(entry) =>
					controller.dispatch({ action: { entry, kind: "rename" }, type: "show-text-sheet" })
				}
			/>
			<MoveEntrySheet
				destinations={controller.moveDestinations}
				entry={controller.uiState.moveEntry}
				error={controller.uiState.moveError}
				onDismiss={() => controller.dispatch({ type: "dismiss-move-sheet" })}
				onMove={controller.handleMoveEntry}
				submitting={controller.uiState.submitting}
				textColor={controller.colors.label}
			/>
			<TextActionSheet
				key={`${controller.uiState.sheetAction?.kind ?? "none"}:${controller.sheetInitialValue}`}
				action={controller.uiState.sheetAction}
				error={controller.uiState.sheetError}
				initialValue={controller.sheetInitialValue}
				onDismiss={() => controller.dispatch({ type: "dismiss-text-sheet" })}
				onSubmit={controller.handleSubmitSheet}
				submitting={controller.uiState.submitting}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 10,
		padding: 16,
		paddingBottom: 44,
	},
	emptyBody: {
		fontSize: 16,
		lineHeight: 22,
		textAlign: "center",
	},
	emptyState: {
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 24,
		paddingVertical: 48,
	},
	emptyTitle: {
		fontSize: 22,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 28,
		textAlign: "center",
	},
	errorText: {
		fontSize: 14,
		lineHeight: 20,
	},
	eyebrow: {
		fontSize: 13,
		fontWeight: "600",
		letterSpacing: 0,
	},
	header: {
		gap: 8,
		paddingBottom: 8,
	},
	headerButton: {
		alignItems: "center",
		minHeight: 32,
		justifyContent: "center",
		paddingHorizontal: 4,
	},
	headerButtonText: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
	},
	moveDestination: {
		borderRadius: 8,
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: 12,
	},
	moveDestinationText: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
	},
	moveList: {
		maxHeight: 280,
	},
	root: {
		flex: 1,
	},
	row: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		minHeight: 64,
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	rowChevron: {
		fontSize: 28,
		fontWeight: "400",
		lineHeight: 30,
		minWidth: 16,
		textAlign: "right",
	},
	rowSubtitle: {
		fontSize: 13,
		lineHeight: 18,
	},
	rowText: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	rowTitle: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
	},
	sheetContent: {
		padding: 16,
	},
	swipeAction: {
		alignItems: "center",
		justifyContent: "center",
		minWidth: 86,
		paddingHorizontal: 10,
	},
	swipeActionText: {
		color: "#ffffff",
		fontSize: 13,
		fontWeight: "700",
		letterSpacing: 0,
	},
	swipeActions: {
		borderRadius: 8,
		flexDirection: "row",
		overflow: "hidden",
	},
})
