import {
	getNotePathPresentation,
	getPortableFileNameError,
	useAppStore,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import type { FileEntry, VaultMetadata, VaultRegistryEntry } from "@cortex/platform"
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
import { FileText, Folder, FolderOpen, Plus } from "lucide-react-native"
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

import { getMobileColorScheme, mobileColors, mobileIconColors } from "@/theme/colors"

type SheetAction =
	| { defaultName: string; folderPath: string; kind: "create-vault" }
	| { kind: "create-note"; parentPath: string }
	| { kind: "create-folder"; parentPath: string }
	| { kind: "rename"; entry: FileEntry }
	| null

interface VaultIdentitySelection {
	color: string
	icon: string
}

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
	onSubmit: (value: string, vaultIdentity?: VaultIdentitySelection) => void
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
	recentVaults: VaultRegistryEntry[]
	onCreateVault: () => void
	onOpenRecentVault: (entry: VaultRegistryEntry) => void
	onOpenVaultFolder: () => void
	version: string | null
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

const defaultVaultIdentity: VaultIdentitySelection = {
	color: "#0a84ff",
	icon: "book",
}

const vaultColorOptions = ["#0a84ff", "#34c759", "#ff9f0a", "#ff375f"] as const

const vaultIconOptions = [
	{ icon: "book", label: "Book" },
	{ icon: "folder", label: "Folder" },
	{ icon: "spark", label: "Spark" },
] as const

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
			return action.defaultName
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
			return "Uses the folder you selected and creates Cortex onboarding files there."
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
	const colors = mobileColors[getMobileColorScheme(useColorScheme())]
	const [validationError, setValidationError] = useState<string | null>(null)
	const [vaultIdentity, setVaultIdentity] =
		useState<VaultIdentitySelection>(defaultVaultIdentity)
	const isVaultIdentitySheet = action?.kind === "create-vault"

	function handleSubmit() {
		const nextValue = draftRef.current.trim()
		const nextValidationError = validateActionName(action, nextValue)
		if (nextValidationError) {
			setValidationError(nextValidationError)
			return
		}

		onSubmit(nextValue, isVaultIdentitySheet ? vaultIdentity : undefined)
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
							{isVaultIdentitySheet ? (
								<View style={styles.identityPicker}>
									<Text style={[styles.identityLabel, { color: colors.secondaryLabel }]}>Color</Text>
									<View style={styles.identityOptions}>
										{vaultColorOptions.map((color) => (
											<Pressable
												accessibilityLabel={`Vault color ${color}`}
												key={color}
												onPress={() => setVaultIdentity((current) => ({ ...current, color }))}
												style={[
													styles.colorSwatch,
													{
														backgroundColor: color,
														borderColor:
															vaultIdentity.color === color ? "#ffffff" : "transparent",
													},
												]}
											/>
										))}
									</View>
									<Text style={[styles.identityLabel, { color: colors.secondaryLabel }]}>Icon</Text>
									<View style={styles.identityOptions}>
										{vaultIconOptions.map((option) => (
											<Pressable
												key={option.icon}
												onPress={() =>
													setVaultIdentity((current) => ({ ...current, icon: option.icon }))
												}
												style={[
													styles.iconChoice,
													{ borderColor: colors.separator },
													vaultIdentity.icon === option.icon ? styles.iconChoiceSelected : null,
												]}
											>
												<Text style={[styles.iconChoiceText, { color: colors.label }]}>
													{option.label}
												</Text>
											</Pressable>
										))}
									</View>
								</View>
							) : null}
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
							<ListItem supportingText="Add content to this vault or connect another folder.">
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
	onCreateVault,
	onDeleteEntry,
	onDuplicateEntry,
	onOpenFolder,
	onOpenNote,
	onOpenRecentVault,
	onRefresh,
	onOpenVaultFolder,
	onRenameEntry,
	onShowEntryActions,
	recentVaults,
	refreshing,
	version,
	vault,
}: NotesListProps) {
	const iconColors = mobileIconColors[getMobileColorScheme(useColorScheme())]

	function renderEntry({ item }: { item: FileEntry }) {
		return (
			<NoteRow
				colors={colors}
				entry={item}
				iconColors={iconColors}
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
			ListEmptyComponent={() => (
				<NotesEmptyState
					colors={colors}
					onCreateVault={onCreateVault}
					onOpenRecentVault={onOpenRecentVault}
					onOpenVaultFolder={onOpenVaultFolder}
					recentVaults={recentVaults}
					vault={vault}
				/>
			)}
			ListHeaderComponent={() => (
				<NotesListHeader colors={colors} error={error} vault={vault} version={version} />
			)}
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
	version,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	error: string | null
	vault: VaultMetadata | null
	version: string | null
}) {
	return (
		<View style={styles.header}>
			<Text style={[styles.eyebrow, { color: colors.secondaryLabel }]}>
				{vault ? (vault.displayPath ?? "Local vault") : `Cortex Mobile ${version ?? ""}`.trim()}
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
	onCreateVault,
	onOpenRecentVault,
	onOpenVaultFolder,
	recentVaults,
	vault,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	onCreateVault: () => void
	onOpenRecentVault: (entry: VaultRegistryEntry) => void
	onOpenVaultFolder: () => void
	recentVaults: VaultRegistryEntry[]
	vault: VaultMetadata | null
}) {
	const iconColors = mobileIconColors[getMobileColorScheme(useColorScheme())]

	if (!vault) {
		return (
			<View style={styles.onboardingState}>
				<Text selectable style={[styles.onboardingTitle, { color: colors.label }]}>
					Cortex Mobile
				</Text>
				<Text selectable style={[styles.emptyBody, { color: colors.secondaryLabel }]}>
					Create a vault in a folder you choose, or reopen one of your recent vaults.
				</Text>
				<View style={styles.onboardingActions}>
					<Pressable
						onPress={onCreateVault}
						style={({ pressed }) => [
							styles.primaryAction,
							{ backgroundColor: colors.tint, opacity: pressed ? 0.7 : 1 },
						]}
					>
						<Plus color="#ffffff" size={18} strokeWidth={2.4} />
						<Text style={styles.primaryActionText}>Create vault</Text>
					</Pressable>
					<Pressable
						onPress={onOpenVaultFolder}
						style={({ pressed }) => [
							styles.secondaryAction,
							{
								borderColor: colors.separator,
								opacity: pressed ? 0.62 : 1,
							},
						]}
					>
						<FolderOpen color={iconColors.tint} size={18} strokeWidth={2.3} />
						<Text style={[styles.secondaryActionText, { color: colors.label }]}>Open folder</Text>
					</Pressable>
				</View>
				{recentVaults.length ? (
					<View style={styles.recentVaults}>
						<Text style={[styles.recentVaultsTitle, { color: colors.secondaryLabel }]}>
							Recent Vaults
						</Text>
						{recentVaults.slice(0, 5).map((entry) => (
							<Pressable
								key={entry.uuid}
								onPress={() => onOpenRecentVault(entry)}
								style={({ pressed }) => [
									styles.recentVaultRow,
									{
										backgroundColor: colors.secondaryBackground,
										borderColor: colors.separator,
										opacity: pressed ? 0.64 : 1,
									},
								]}
							>
								<Text numberOfLines={1} style={[styles.recentVaultName, { color: colors.label }]}>
									{entry.name}
								</Text>
								<Text
									numberOfLines={1}
									style={[styles.recentVaultPath, { color: colors.secondaryLabel }]}
								>
									{entry.displayPath ?? entry.path}
								</Text>
							</Pressable>
						))}
					</View>
				) : null}
			</View>
		)
	}

	return (
		<View style={styles.emptyState}>
			<Text selectable style={[styles.emptyTitle, { color: colors.label }]}>
				No notes here
			</Text>
			<Text selectable style={[styles.emptyBody, { color: colors.secondaryLabel }]}>
				Create a note or folder in this vault.
			</Text>
		</View>
	)
}

function NoteRow({
	colors,
	entry,
	iconColors,
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
	iconColors: (typeof mobileIconColors)[keyof typeof mobileIconColors]
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
				<View style={[styles.rowIcon, { backgroundColor: colors.groupedBackground }]}>
					{entry.isDir ? (
						<Folder color={iconColors.tint} size={20} strokeWidth={2.25} />
					) : (
						<FileText color={iconColors.secondary} size={20} strokeWidth={2.15} />
					)}
				</View>
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
	const iconColors = mobileIconColors[scheme]
	const version = useAppStore((state) => state.version)
	const markFirstRunOnboardingSeen = useAppStore((state) => state.markFirstRunOnboardingSeen)
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const loading = useVaultStore((state) => state.loading)
	const error = useVaultStore((state) => state.error)
	const pendingOnboardingNotePath = useVaultStore((state) => state.pendingOnboardingNotePath)
	const openVault = useVaultStore((state) => state.openVault)
	const closeVault = useVaultStore((state) => state.closeVault)
	const loadRecentVaults = useVaultStore((state) => state.loadRecentVaults)
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
			: (vault?.name ?? "Files")
	const sheetInitialValue =
		uiState.sheetAction?.kind === "rename"
			? getNoteInputName(uiState.sheetAction.entry)
			: uiState.sheetAction?.kind === "create-vault"
				? uiState.sheetAction.defaultName
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

	async function handleOpenVaultAfterSelection(
		path: string,
		options: {
			color?: string | null
			createOnboardingNote?: boolean
			icon?: string | null
			name?: string
		},
	) {
		const openOptions = {
			color: options.color ?? undefined,
			createOnboardingNote: options.createOnboardingNote,
			icon: options.icon ?? undefined,
			name: options.name,
		}
		if (vault && vault.path !== path) {
			await closeVault()
		}
		await openVault(path, openOptions)
		const openedVault = useVaultStore.getState().vault
		if (!openedVault) {
			throw new Error(useVaultStore.getState().error ?? "Unable to open vault")
		}
		await Promise.all([markFirstRunOnboardingSeen(), loadRecentVaults()])
		router.replace("/(notes)" as never)
	}

	async function handlePickVaultFolder() {
		dispatch({ presented: false, type: "show-create-actions" })
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return
		const existingRecent = recentVaults.find((entry) => entry.path === folderPath)
		if (existingRecent) {
			await handleOpenVaultAfterSelection(folderPath, {
				color: existingRecent.color,
				icon: existingRecent.icon,
				name: existingRecent.name,
			})
			return
		}

		let defaultName = "Personal"
		try {
			const metadata = await getPlatform().vault.getVaultMetadata(folderPath)
			defaultName = metadata.name || "Personal"
		} catch {
			defaultName = "Personal"
		}

		dispatch({
			action: { defaultName, folderPath, kind: "create-vault" },
			type: "show-text-sheet",
		})
	}

	function handleSubmitSheet(value: string, vaultIdentity?: VaultIdentitySelection) {
		if (!uiState.sheetAction) return
		dispatch({ submitting: true, type: "set-submitting" })
		dispatch({ error: null, type: "set-sheet-error" })

		const actionPromise = (async () => {
			switch (uiState.sheetAction?.kind) {
				case "create-vault": {
					await handleOpenVaultAfterSelection(uiState.sheetAction.folderPath, {
						color: vaultIdentity?.color ?? defaultVaultIdentity.color,
						createOnboardingNote: true,
						icon: vaultIdentity?.icon ?? defaultVaultIdentity.icon,
						name: value,
					})
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
				? "This deletes the folder and every note inside it from the selected vault."
				: "This deletes the note from the selected vault.",
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
			void handlePickVaultFolder().catch((pickError) => {
				dispatch({
					error: pickError instanceof Error ? pickError.message : String(pickError),
					type: "set-sheet-error",
				})
			})
			return
		}
		dispatch({ presented: true, type: "show-create-actions" })
	}

	function handleOpenRecentVault(entry: VaultRegistryEntry) {
		void handleOpenVaultAfterSelection(entry.path, {
			color: entry.color,
			icon: entry.icon,
			name: entry.name,
		}).catch((recentError) => {
			dispatch({
				error: recentError instanceof Error ? recentError.message : String(recentError),
				type: "set-sheet-error",
			})
		})
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
		handleOpenRecentVault,
		handlePickVaultFolder,
		handleRefresh,
		handleSubmitSheet,
		loading,
		moveDestinations,
		openNote,
		recentVaults,
		sheetInitialValue,
		iconColors,
		uiState,
		version,
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
							<Plus color={controller.iconColors.tint} size={22} strokeWidth={2.35} />
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
				onCreateVault={controller.handlePickVaultFolder}
				onDeleteEntry={(entry) => {
					void controller.handleDeleteEntry(entry)
				}}
				onDuplicateEntry={controller.handleDuplicateEntry}
				onOpenFolder={controller.handleOpenFolder}
				onOpenNote={controller.openNote}
				onOpenRecentVault={controller.handleOpenRecentVault}
				onRefresh={controller.handleRefresh}
				onOpenVaultFolder={controller.handlePickVaultFolder}
				onRenameEntry={(entry) =>
					controller.dispatch({ action: { entry, kind: "rename" }, type: "show-text-sheet" })
				}
				onShowEntryActions={(entry) => {
					triggerSelectionHaptic()
					controller.dispatch({ entry, type: "show-entry-actions" })
				}}
				recentVaults={controller.recentVaults}
				refreshing={controller.uiState.refreshing}
				version={controller.version}
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
					void controller.handlePickVaultFolder().catch((pickError) => {
						controller.dispatch({
							error: pickError instanceof Error ? pickError.message : String(pickError),
							type: "set-sheet-error",
						})
					})
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
	iconChoice: {
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		minHeight: 34,
		justifyContent: "center",
		paddingHorizontal: 12,
	},
	iconChoiceSelected: {
		borderWidth: 1,
	},
	iconChoiceText: {
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 18,
	},
	identityLabel: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 16,
		textTransform: "uppercase",
	},
	identityOptions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	identityPicker: {
		gap: 8,
		paddingTop: 8,
	},
	colorSwatch: {
		borderRadius: 15,
		borderWidth: 2,
		height: 30,
		width: 30,
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
	onboardingActions: {
		gap: 10,
		width: "100%",
	},
	onboardingState: {
		alignItems: "center",
		gap: 14,
		paddingHorizontal: 20,
		paddingVertical: 40,
	},
	onboardingTitle: {
		fontSize: 28,
		fontWeight: "800",
		letterSpacing: 0,
		lineHeight: 34,
		textAlign: "center",
	},
	primaryAction: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 8,
		justifyContent: "center",
		minHeight: 48,
		paddingHorizontal: 14,
	},
	primaryActionText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 21,
	},
	recentVaultName: {
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 20,
	},
	recentVaultPath: {
		fontSize: 12,
		letterSpacing: 0,
		lineHeight: 16,
	},
	recentVaultRow: {
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 2,
		justifyContent: "center",
		minHeight: 54,
		paddingHorizontal: 12,
	},
	recentVaults: {
		gap: 8,
		paddingTop: 4,
		width: "100%",
	},
	recentVaultsTitle: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 16,
		textTransform: "uppercase",
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
	rowIcon: {
		alignItems: "center",
		borderRadius: 8,
		height: 36,
		justifyContent: "center",
		width: 36,
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
	secondaryAction: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 8,
		justifyContent: "center",
		minHeight: 46,
		paddingHorizontal: 14,
	},
	secondaryActionText: {
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 21,
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
