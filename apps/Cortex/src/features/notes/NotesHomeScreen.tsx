import {
	getNotePathPresentation,
	getPortableFileNameError,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
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
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	useColorScheme,
	View,
} from "react-native"

import { createLocalVault } from "@/features/vault/local-vault"
import { getMobileColorScheme, mobileColors } from "@/theme/colors"

type SheetAction =
	| { kind: "create-vault" }
	| { kind: "create-note"; parentPath: string }
	| { kind: "create-folder"; parentPath: string }
	| { kind: "rename"; entry: FileEntry }
	| null

interface TextActionSheetProps {
	action: SheetAction
	error: string | null
	initialValue: string
	onDismiss: () => void
	onSubmit: (value: string) => void
	submitting: boolean
}

function getParentPath(path: string): string {
	const normalizedPath = path.replace(/\/+$/u, "")
	return normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
}

function getFileName(path: string): string {
	return path.split("/").pop() ?? path
}

function getNoteInputName(entry: FileEntry): string {
	if (entry.isDir) return entry.name
	return entry.name.replace(/\.md$/iu, "")
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

	const handleSubmit = useCallback(() => {
		const nextValue = draftRef.current.trim()
		const nextValidationError = validateActionName(action, nextValue)
		if (nextValidationError) {
			setValidationError(nextValidationError)
			return
		}

		void onSubmit(nextValue)
	}, [action, onSubmit])

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
									const nextValidationError = validateActionName(action, value.trim())
									if (nextValidationError) {
										setValidationError(nextValidationError)
										return
									}

									void onSubmit(value.trim())
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

export default function NotesHomeScreen() {
	const router = useRouter()
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
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const clearPendingOnboardingNotePath = useVaultStore(
		(state) => state.clearPendingOnboardingNotePath,
	)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const setActiveFile = useEditorStore((state) => state.setActiveFile)
	const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)
	const [sheetAction, setSheetAction] = useState<SheetAction>(null)
	const [sheetError, setSheetError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)

	const selectedFolderStillExists = Boolean(
		vault &&
			currentFolderPath &&
			(currentFolderPath === vault.path ||
				files.some((file) => file.isDir && file.path === currentFolderPath)),
	)
	const effectiveCurrentFolderPath = vault
		? selectedFolderStillExists
			? currentFolderPath
			: vault.path
		: null

	const openNote = useCallback(
		(filePath: string) => {
			openTab(filePath, { reuseActive: true })
			setActiveFile(filePath)
			router.push({
				params: { filePath },
				pathname: "/note",
			})
		},
		[openTab, router, setActiveFile],
	)

	useEffect(() => {
		if (!pendingOnboardingNotePath) return
		openNote(pendingOnboardingNotePath)
		clearPendingOnboardingNotePath()
	}, [clearPendingOnboardingNotePath, openNote, pendingOnboardingNotePath])

	const visibleEntries = useMemo(() => {
		if (!effectiveCurrentFolderPath) return []
		return files.filter((file) => getParentPath(file.path) === effectiveCurrentFolderPath)
	}, [effectiveCurrentFolderPath, files])

	const currentFolderTitle = useMemo(() => {
		if (!vault || !effectiveCurrentFolderPath || effectiveCurrentFolderPath === vault.path) {
			return vault?.name ?? "Notes"
		}

		return getFileName(effectiveCurrentFolderPath)
	}, [effectiveCurrentFolderPath, vault])

	const sheetInitialValue = useMemo(() => {
		if (sheetAction?.kind === "rename") return getNoteInputName(sheetAction.entry)
		if (sheetAction?.kind === "create-vault") return "Personal"
		return ""
	}, [sheetAction])

	const handleDismissSheet = useCallback(() => {
		if (submitting) return
		setSheetAction(null)
		setSheetError(null)
	}, [submitting])

	const handleRefresh = useCallback(() => {
		if (!vault) return
		setRefreshing(true)
		void refreshFiles().finally(() => setRefreshing(false))
	}, [refreshFiles, vault])

	const handleSubmitSheet = useCallback(
		(value: string) => {
			if (!sheetAction) return
			setSubmitting(true)
			setSheetError(null)

			const actionPromise = (async () => {
				switch (sheetAction.kind) {
					case "create-vault": {
						const createdVault = await createLocalVault(value)
						await openVault(createdVault.path, {
							createOnboardingNote: true,
							name: createdVault.name,
						})
						setCurrentFolderPath(createdVault.path)
						break
					}
					case "create-note": {
						const filePath = await createFile(sheetAction.parentPath, value)
						openNote(filePath)
						break
					}
					case "create-folder": {
						await createFolder(sheetAction.parentPath, value)
						break
					}
					case "rename": {
						const nextName = sheetAction.entry.isDir
							? value
							: value.endsWith(".md")
								? value
								: `${value}.md`
						const renamedPath = await renameFile(sheetAction.entry.path, nextName)
						if (sheetAction.entry.isDir && currentFolderPath === sheetAction.entry.path) {
							setCurrentFolderPath(renamedPath)
						}
						break
					}
				}
			})()

			void actionPromise
				.then(() => {
					setSheetAction(null)
				})
				.catch((submitError) => {
					setSheetError(submitError instanceof Error ? submitError.message : String(submitError))
				})
				.finally(() => setSubmitting(false))
		},
		[createFile, createFolder, currentFolderPath, openNote, openVault, renameFile, sheetAction],
	)

	const handleDeleteEntry = useCallback(
		async (entry: FileEntry) => {
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
			if (entry.isDir && currentFolderPath?.startsWith(entry.path)) {
				setCurrentFolderPath(vault?.path ?? null)
			}
		},
		[currentFolderPath, deleteFile, vault],
	)

	const renderEntry = useCallback(
		({ item }: { item: FileEntry }) => {
			const title = item.isDir
				? item.name
				: getNotePathPresentation(item.path, vault?.path).title || item.name
			const supportingText = item.isDir ? "Folder" : "Markdown note"

			return (
				<Pressable
					onLongPress={() => setSheetAction({ entry: item, kind: "rename" })}
					onPress={() => {
						if (item.isDir) {
							setCurrentFolderPath(item.path)
							return
						}

						openNote(item.path)
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
					<Pressable
						hitSlop={8}
						onPress={() => setSheetAction({ entry: item, kind: "rename" })}
						style={({ pressed }) => [
							styles.rowAction,
							{
								opacity: pressed ? 0.52 : 1,
							},
						]}
					>
						<Text style={[styles.rowActionText, { color: colors.tint }]}>Rename</Text>
					</Pressable>
					<Pressable
						hitSlop={8}
						onPress={() => {
							void handleDeleteEntry(item)
						}}
						style={({ pressed }) => [
							styles.rowAction,
							{
								opacity: pressed ? 0.52 : 1,
							},
						]}
					>
						<Text style={[styles.rowActionText, { color: colors.destructive }]}>Delete</Text>
					</Pressable>
				</Pressable>
			)
		},
		[colors, handleDeleteEntry, openNote, vault?.path],
	)

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<FlatList
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
				data={visibleEntries}
				keyExtractor={(item) => item.path}
				ListEmptyComponent={
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
				}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.eyebrow, { color: colors.secondaryLabel }]}>
							{vault ? "Local vault" : "Cortex Mobile"}
						</Text>
						<Text style={[styles.title, { color: colors.label }]}>{currentFolderTitle}</Text>
						{error ? (
							<Text selectable style={[styles.errorText, { color: colors.destructive }]}>
								{error}
							</Text>
						) : null}
						<View style={styles.actions}>
							<Pressable
								onPress={() => setSheetAction({ kind: "create-vault" })}
								style={({ pressed }) => [
									styles.primaryAction,
									{
										backgroundColor: colors.tint,
										opacity: pressed ? 0.72 : 1,
									},
								]}
							>
								<Text style={styles.primaryActionText}>{vault ? "New vault" : "Create vault"}</Text>
							</Pressable>
							{vault && effectiveCurrentFolderPath ? (
								<>
									<Pressable
										onPress={() =>
											setSheetAction({
												kind: "create-note",
												parentPath: effectiveCurrentFolderPath,
											})
										}
										style={({ pressed }) => [
											styles.secondaryAction,
											{
												backgroundColor: colors.secondaryBackground,
												borderColor: colors.separator,
												opacity: pressed ? 0.72 : 1,
											},
										]}
									>
										<Text style={[styles.secondaryActionText, { color: colors.label }]}>
											New note
										</Text>
									</Pressable>
									<Pressable
										onPress={() =>
											setSheetAction({
												kind: "create-folder",
												parentPath: effectiveCurrentFolderPath,
											})
										}
										style={({ pressed }) => [
											styles.secondaryAction,
											{
												backgroundColor: colors.secondaryBackground,
												borderColor: colors.separator,
												opacity: pressed ? 0.72 : 1,
											},
										]}
									>
										<Text style={[styles.secondaryActionText, { color: colors.label }]}>
											New folder
										</Text>
									</Pressable>
								</>
							) : null}
						</View>
						{vault && effectiveCurrentFolderPath && effectiveCurrentFolderPath !== vault.path ? (
							<Pressable
								onPress={() => setCurrentFolderPath(getParentPath(effectiveCurrentFolderPath))}
								style={({ pressed }) => [
									styles.backRow,
									{
										backgroundColor: colors.secondaryBackground,
										borderColor: colors.separator,
										opacity: pressed ? 0.72 : 1,
									},
								]}
							>
								<Text style={[styles.backRowText, { color: colors.tint }]}>Back</Text>
							</Pressable>
						) : null}
					</View>
				}
				refreshControl={
					<RefreshControl
						onRefresh={handleRefresh}
						refreshing={refreshing || loading}
						tintColor={colors.tint}
					/>
				}
				renderItem={renderEntry}
			/>
			<TextActionSheet
				key={`${sheetAction?.kind ?? "none"}:${sheetInitialValue}`}
				action={sheetAction}
				error={sheetError}
				initialValue={sheetInitialValue}
				onDismiss={handleDismissSheet}
				onSubmit={handleSubmitSheet}
				submitting={submitting}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
	},
	backRow: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		minHeight: 44,
		paddingHorizontal: 14,
		justifyContent: "center",
	},
	backRowText: {
		fontSize: 15,
		fontWeight: "600",
		letterSpacing: 0,
	},
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
		gap: 12,
		paddingBottom: 8,
	},
	primaryAction: {
		alignItems: "center",
		borderRadius: 8,
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	primaryActionText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
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
	rowAction: {
		alignItems: "center",
		minHeight: 36,
		justifyContent: "center",
		paddingHorizontal: 4,
	},
	rowActionText: {
		fontSize: 13,
		fontWeight: "600",
		letterSpacing: 0,
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
	secondaryAction: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	secondaryActionText: {
		fontSize: 15,
		fontWeight: "600",
		letterSpacing: 0,
	},
	sheetContent: {
		padding: 16,
	},
	title: {
		fontSize: 32,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 38,
	},
})
