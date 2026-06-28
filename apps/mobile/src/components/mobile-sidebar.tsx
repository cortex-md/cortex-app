import {
	getNotePathPresentation,
	getPortableFileNameError,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import type { FileEntry, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	BottomSheet,
	Button as ExpoButton,
	Column,
	FieldGroup,
	Host,
	ListItem,
} from "@expo/ui"
import * as Haptics from "expo-haptics"
import { useRouter } from "expo-router"
import {
	ChevronDown,
	ChevronRight,
	ChevronsDown,
	ChevronsUp,
	Copy,
	Edit2,
	FilePlus,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	Menu,
	MoreHorizontal,
	Move,
	RefreshCw,
	Search,
	Settings,
	Trash2,
	X,
	type LucideIcon,
} from "lucide-react-native"
import {
	createContext,
	type PropsWithChildren,
	use,
	useReducer,
	useRef,
	useState,
} from "react"
import {
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	type ColorValue,
	useColorScheme,
	useWindowDimensions,
	View,
} from "react-native"
import DrawerLayout from "react-native-gesture-handler/DrawerLayout"

import { MobileTextField } from "@/components/mobile-text-field"
import { openMobileVault } from "@/runtime/mobile-vault-session"
import {
	getMobileColorScheme,
	mobileColors,
	mobileIconColors,
	mobileStaticColors,
} from "@/theme/colors"

interface MobileSidebarContextValue {
	closeSidebar: () => void
	openSidebar: () => void
}

interface SidebarFileRow {
	depth: number
	entry: FileEntry
}

type TextSheetAction =
	| { kind: "create-note"; parentPath: string }
	| { kind: "create-folder"; parentPath: string }
	| { kind: "rename"; entry: FileEntry }
	| null

interface MoveDestination {
	label: string
	path: string
}

interface SidebarUiState {
	entryActionsEntry: FileEntry | null
	expandedFolders: ReadonlySet<string>
	morePresented: boolean
	moveEntry: FileEntry | null
	moveError: string | null
	submitting: boolean
	switcherPresented: boolean
	textAction: TextSheetAction
	textError: string | null
}

type SidebarUiAction =
	| { type: "set-entry-actions-entry"; entry: FileEntry | null }
	| { type: "set-expanded-folders"; folders: ReadonlySet<string> }
	| { type: "set-more-presented"; presented: boolean }
	| { type: "set-move-entry"; entry: FileEntry | null }
	| { type: "set-move-error"; error: string | null }
	| { type: "set-submitting"; submitting: boolean }
	| { type: "set-switcher-presented"; presented: boolean }
	| { type: "set-text-action"; action: TextSheetAction }
	| { type: "set-text-error"; error: string | null }
	| { type: "toggle-folder"; path: string }

const initialSidebarUiState: SidebarUiState = {
	entryActionsEntry: null,
	expandedFolders: new Set(),
	morePresented: false,
	moveEntry: null,
	moveError: null,
	submitting: false,
	switcherPresented: false,
	textAction: null,
	textError: null,
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null)

function sidebarUiReducer(state: SidebarUiState, action: SidebarUiAction): SidebarUiState {
	switch (action.type) {
		case "set-entry-actions-entry":
			return { ...state, entryActionsEntry: action.entry }
		case "set-expanded-folders":
			return { ...state, expandedFolders: action.folders }
		case "set-more-presented":
			return { ...state, morePresented: action.presented }
		case "set-move-entry":
			return { ...state, moveEntry: action.entry, moveError: null }
		case "set-move-error":
			return { ...state, moveError: action.error }
		case "set-submitting":
			return { ...state, submitting: action.submitting }
		case "set-switcher-presented":
			return { ...state, switcherPresented: action.presented }
		case "set-text-action":
			return { ...state, textAction: action.action, textError: null }
		case "set-text-error":
			return { ...state, textError: action.error }
		case "toggle-folder": {
			const expandedFolders = new Set(state.expandedFolders)
			if (expandedFolders.has(action.path)) expandedFolders.delete(action.path)
			else expandedFolders.add(action.path)
			return { ...state, expandedFolders }
		}
	}
}

export function useMobileSidebar(): MobileSidebarContextValue {
	const context = use(MobileSidebarContext)
	if (!context) {
		throw new Error("useMobileSidebar must be used inside MobileSidebarProvider")
	}

	return context
}

function getParentPath(path: string): string {
	const normalizedPath = path.replace(/\/+$/u, "")
	return normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
}

function isPathOrDescendant(path: string, parentPath: string): boolean {
	return path === parentPath || path.startsWith(`${parentPath}/`)
}

function isMarkdownEntry(entry: FileEntry): boolean {
	return !entry.isDir && entry.name.toLowerCase().endsWith(".md")
}

function getEntryInputName(entry: FileEntry): string {
	if (entry.isDir) return entry.name
	return entry.name.replace(/\.md$/iu, "")
}

function getEntryTitle(entry: FileEntry, vaultPath?: string): string {
	if (entry.isDir) return entry.name
	return getNotePathPresentation(entry.path, vaultPath).title || entry.name
}

function buildSidebarRows(
	files: FileEntry[],
	vaultPath: string | null,
	expandedFolders: ReadonlySet<string>,
): SidebarFileRow[] {
	if (!vaultPath) return []

	const childrenByParent = new Map<string, FileEntry[]>()
	for (const file of files) {
		const parentPath = getParentPath(file.path)
		const children = childrenByParent.get(parentPath) ?? []
		children.push(file)
		childrenByParent.set(parentPath, children)
	}

	const rows: SidebarFileRow[] = []
	const appendChildren = (parentPath: string, depth: number) => {
		for (const child of childrenByParent.get(parentPath) ?? []) {
			rows.push({ depth, entry: child })
			if (child.isDir && expandedFolders.has(child.path)) {
				appendChildren(child.path, depth + 1)
			}
		}
	}

	appendChildren(vaultPath, 0)
	return rows
}

function buildMoveDestinations(
	files: FileEntry[],
	moveEntry: FileEntry | null,
	vaultPath: string | null,
	vaultName: string,
): MoveDestination[] {
	if (!moveEntry || !vaultPath) return []
	const destinations: MoveDestination[] = [{ label: vaultName, path: vaultPath }]
	for (const file of files) {
		if (!file.isDir) continue
		if (file.path === vaultPath) continue
		if (moveEntry.isDir && isPathOrDescendant(file.path, moveEntry.path)) continue
		destinations.push({ label: file.name, path: file.path })
	}
	return destinations
}

function validateTextActionName(action: TextSheetAction, value: string): string | null {
	const trimmedValue = value.trim()
	if (!trimmedValue) return "Name cannot be empty."

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

function getTextActionTitle(action: TextSheetAction): string {
	switch (action?.kind) {
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

function getTextActionPlaceholder(action: TextSheetAction): string {
	switch (action?.kind) {
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

function triggerSelectionHaptic(): void {
	void Haptics.selectionAsync().catch(() => {})
}

function triggerDeleteHaptic(): void {
	void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

async function showSidebarError(title: string, error: unknown): Promise<void> {
	await getPlatform().dialog.showAlert({
		message: formatError(error),
		title,
	})
}

async function runSubmittingTask(
	setSubmitting: (value: boolean) => void,
	task: () => Promise<void>,
	onError: (error: unknown) => Promise<void> | void,
): Promise<void> {
	setSubmitting(true)
	try {
		await task()
	} catch (error) {
		await onError(error)
	} finally {
		setSubmitting(false)
	}
}

function SidebarToggleIcon({ color }: { color: string }) {
	return <Menu color={color} size={22} strokeWidth={2.25} />
}

export function SidebarToggleButton({ color }: { color?: string }) {
	const scheme = getMobileColorScheme(useColorScheme())
	const iconColors = mobileIconColors[scheme]
	const { openSidebar } = useMobileSidebar()

	return (
		<Pressable
			accessibilityLabel="Open sidebar"
			hitSlop={8}
			onPress={openSidebar}
			style={({ pressed }) => [styles.headerIconButton, { opacity: pressed ? 0.52 : 1 }]}
		>
			<SidebarToggleIcon color={color ?? iconColors.tint} />
		</Pressable>
	)
}

function useMobileSidebarDrawer(closeSidebar: () => void) {
	const router = useRouter()
	const { width } = useWindowDimensions()
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const iconColors = mobileIconColors[scheme]
	const staticColors = mobileStaticColors[scheme]
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const createFile = useVaultStore((state) => state.createFile)
	const createFolder = useVaultStore((state) => state.createFolder)
	const deleteFile = useVaultStore((state) => state.deleteFile)
	const duplicateFile = useVaultStore((state) => state.duplicateFile)
	const moveFile = useVaultStore((state) => state.moveFile)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const renameFile = useVaultStore((state) => state.renameFile)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const setActiveFile = useEditorStore((state) => state.setActiveFile)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [uiState, dispatchUi] = useReducer(sidebarUiReducer, initialSidebarUiState)
	const setSubmitting = (submitting: boolean) =>
		dispatchUi({ submitting, type: "set-submitting" })
	const drawerWidth = Math.min(Math.max(width * 0.86, 308), 390)
	const rows = buildSidebarRows(files, vault?.path ?? null, uiState.expandedFolders)
	const folderPaths: string[] = []
	for (const file of files) {
		if (file.isDir) folderPaths.push(file.path)
	}
	const allFoldersExpanded =
		folderPaths.length > 0 && folderPaths.every((path) => uiState.expandedFolders.has(path))
	const moveDestinations = buildMoveDestinations(
		files,
		uiState.moveEntry,
		vault?.path ?? null,
		vault?.name ?? "Vault",
	)
	const textInitialValue =
		uiState.textAction?.kind === "rename" ? getEntryInputName(uiState.textAction.entry) : ""

	function handleOpenNote(filePath: string) {
		openTab(filePath, { reuseActive: true })
		setActiveFile(filePath)
		closeSidebar()
		router.push({
			params: { filePath },
			pathname: "/(notes)/note" as never,
		})
	}

	function handleToggleFolder(folderPath: string) {
		triggerSelectionHaptic()
		dispatchUi({ path: folderPath, type: "toggle-folder" })
	}

	async function handleOpenRecentVault(entry: VaultRegistryEntry) {
		await runSubmittingTask(
			setSubmitting,
			async () => {
				await openMobileVault(entry.path, {
					color: entry.color ?? undefined,
					icon: entry.icon ?? undefined,
					name: entry.name,
				})
				dispatchUi({ presented: false, type: "set-switcher-presented" })
				closeSidebar()
				router.replace("/(notes)" as never)
			},
			(error) => showSidebarError("Could not open vault", error),
		)
	}

	async function handleBrowseVault() {
		await runSubmittingTask(
			setSubmitting,
			async () => {
				const folderPath = await getPlatform().dialog.pickFolder()
				if (!folderPath) return
				const recentVault = useVaultStore
					.getState()
					.recentVaults.find((entry) => entry.path === folderPath)
				const metadata = recentVault
					? null
					: await getPlatform()
							.vault.getVaultMetadata(folderPath)
							.catch(() => null)
				await openMobileVault(folderPath, {
					color: recentVault?.color ?? undefined,
					icon: recentVault?.icon ?? undefined,
					name: recentVault?.name ?? metadata?.name,
				})
				dispatchUi({ presented: false, type: "set-switcher-presented" })
				closeSidebar()
				router.replace("/(notes)" as never)
			},
			(error) => showSidebarError("Could not open vault", error),
		)
	}

	function handleRefresh() {
		void refreshFiles()
	}

	function handleExpandCollapseAll() {
		triggerSelectionHaptic()
		dispatchUi({
			folders: allFoldersExpanded ? new Set() : new Set(folderPaths),
			type: "set-expanded-folders",
		})
		dispatchUi({ presented: false, type: "set-more-presented" })
	}

	function handleOpenEntryActions(entry: FileEntry) {
		triggerSelectionHaptic()
		dispatchUi({ entry, type: "set-entry-actions-entry" })
	}

	async function handleSubmitTextAction(value: string) {
		const action = uiState.textAction
		if (!action) return

		const validationError = validateTextActionName(action, value)
		if (validationError) {
			dispatchUi({ error: validationError, type: "set-text-error" })
			return
		}

		dispatchUi({ error: null, type: "set-text-error" })
		await runSubmittingTask(
			setSubmitting,
			async () => {
				switch (action.kind) {
					case "create-note": {
						const filePath = await createFile(action.parentPath, value)
						handleOpenNote(filePath)
						break
					}
					case "create-folder":
						await createFolder(action.parentPath, value)
						break
					case "rename": {
						const nextName = action.entry.isDir
							? value
							: value.endsWith(".md")
								? value
								: `${value}.md`
						const renamedPath = await renameFile(action.entry.path, nextName)
						if (activeFilePath === action.entry.path && !action.entry.isDir) {
							setActiveFile(renamedPath)
						}
						break
					}
				}
				dispatchUi({ action: null, type: "set-text-action" })
			},
			(error) => dispatchUi({ error: formatError(error), type: "set-text-error" }),
		)
	}

	async function handleDeleteEntry(entry: FileEntry) {
		triggerDeleteHaptic()
		const confirmed = await getPlatform().dialog.showConfirm({
			cancelLabel: "Cancel",
			confirmLabel: "Delete",
			destructive: true,
			message: entry.isDir
				? "This deletes the folder and every note inside it from this vault."
				: "This deletes the note from this vault.",
			title: entry.isDir ? "Delete folder?" : "Delete note?",
		})

		if (!confirmed) return
		await runSubmittingTask(
			setSubmitting,
			async () => {
				await deleteFile(entry.path)
				dispatchUi({ entry: null, type: "set-entry-actions-entry" })
			},
			(error) => showSidebarError("Could not delete item", error),
		)
	}

	async function handleDuplicateEntry(entry: FileEntry) {
		if (!isMarkdownEntry(entry)) return
		triggerSelectionHaptic()
		await runSubmittingTask(
			setSubmitting,
			async () => {
				const filePath = await duplicateFile(entry.path)
				dispatchUi({ entry: null, type: "set-entry-actions-entry" })
				handleOpenNote(filePath)
			},
			(error) => showSidebarError("Could not duplicate note", error),
		)
	}

	async function handleMoveEntry(targetParentPath: string) {
		const entry = uiState.moveEntry
		if (!entry) return
		triggerSelectionHaptic()
		dispatchUi({ error: null, type: "set-move-error" })
		await runSubmittingTask(
			setSubmitting,
			async () => {
				const movedPath = await moveFile(entry.path, targetParentPath)
				if (activeFilePath === entry.path && !entry.isDir) {
					setActiveFile(movedPath)
				}
				dispatchUi({ entry: null, type: "set-move-entry" })
			},
			(error) => dispatchUi({ error: formatError(error), type: "set-move-error" }),
		)
	}

	function openCreateNoteSheet() {
		if (!vault) return
		triggerSelectionHaptic()
		dispatchUi({ action: { kind: "create-note", parentPath: vault.path }, type: "set-text-action" })
	}

	function openCreateFolderSheet() {
		if (!vault) return
		triggerSelectionHaptic()
		dispatchUi({ action: { kind: "create-folder", parentPath: vault.path }, type: "set-text-action" })
	}

	const renderSidebar = () => (
		<View style={[styles.sidebar, { backgroundColor: staticColors.groupedBackground }]}>
			<View style={styles.topBar}>
				<WorkspaceSwitcher
					colors={colors}
					iconColors={iconColors}
					onPress={() => {
						triggerSelectionHaptic()
						dispatchUi({ presented: true, type: "set-switcher-presented" })
					}}
					vaultName={vault?.name ?? "Cortex"}
				/>
				<Pressable
					accessibilityLabel="Close sidebar"
					hitSlop={8}
					onPress={closeSidebar}
					style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.52 : 1 }]}
				>
					<X color={iconColors.secondary} size={20} strokeWidth={2.25} />
				</Pressable>
			</View>

			<View style={styles.actionBar}>
				<SidebarIconButton
					Icon={FilePlus}
					color={iconColors.tint}
					label="New note"
					onPress={openCreateNoteSheet}
				/>
				<SidebarIconButton
					Icon={FolderPlus}
					color={iconColors.tint}
					label="New folder"
					onPress={openCreateFolderSheet}
				/>
				<SidebarIconButton
					Icon={Search}
					color={iconColors.secondary}
					label="Search"
					onPress={() => {
						closeSidebar()
						router.push("/(search)" as never)
					}}
				/>
				<SidebarIconButton
					Icon={MoreHorizontal}
					color={iconColors.secondary}
					label="More"
					onPress={() => {
						triggerSelectionHaptic()
						dispatchUi({ presented: true, type: "set-more-presented" })
					}}
				/>
				<SidebarIconButton
					Icon={Settings}
					color={iconColors.secondary}
					label="Settings"
					onPress={() => {
						closeSidebar()
						router.push("/(settings)" as never)
					}}
				/>
			</View>

			<FlatList
				contentContainerStyle={styles.fileListContent}
				data={rows}
				keyExtractor={(item) => item.entry.path}
				ListEmptyComponent={
					<View style={styles.emptySidebar}>
						<Text selectable style={[styles.emptySidebarTitle, { color: colors.label }]}>
							No notes yet
						</Text>
						<Text selectable style={[styles.emptySidebarText, { color: colors.secondaryLabel }]}>
							Create a note or folder from the icons above.
						</Text>
					</View>
				}
				onRefresh={handleRefresh}
				refreshing={false}
				renderItem={({ item }) => (
					<SidebarFileItem
						active={activeFilePath === item.entry.path}
						colors={colors}
						depth={item.depth}
						entry={item.entry}
						expanded={uiState.expandedFolders.has(item.entry.path)}
						iconColors={iconColors}
						onLongPress={handleOpenEntryActions}
						onOpenNote={handleOpenNote}
						onToggleFolder={handleToggleFolder}
						vaultPath={vault?.path}
					/>
				)}
				style={styles.fileList}
			/>

			<WorkspaceSwitcherSheet
				activeVaultUuid={vault?.uuid ?? null}
				isPresented={uiState.switcherPresented}
				onBrowseVault={handleBrowseVault}
				onDismiss={() => {
					if (!uiState.submitting) {
						dispatchUi({ presented: false, type: "set-switcher-presented" })
					}
				}}
				onOpenRecentVault={handleOpenRecentVault}
				recentVaults={recentVaults}
				submitting={uiState.submitting}
			/>
			<MoreActionsSheet
				allFoldersExpanded={allFoldersExpanded}
				isPresented={uiState.morePresented}
				onDismiss={() => dispatchUi({ presented: false, type: "set-more-presented" })}
				onExpandCollapseAll={handleExpandCollapseAll}
				onRefresh={() => {
					dispatchUi({ presented: false, type: "set-more-presented" })
					handleRefresh()
				}}
			/>
			<EntryActionsSheet
				entry={uiState.entryActionsEntry}
				onDelete={(entry) => {
					void handleDeleteEntry(entry)
				}}
				onDismiss={() => {
					if (!uiState.submitting) {
						dispatchUi({ entry: null, type: "set-entry-actions-entry" })
					}
				}}
				onDuplicate={(entry) => {
					void handleDuplicateEntry(entry)
				}}
				onMove={(entry) => {
					dispatchUi({ entry: null, type: "set-entry-actions-entry" })
					dispatchUi({ entry, type: "set-move-entry" })
				}}
				onRename={(entry) => {
					dispatchUi({ entry: null, type: "set-entry-actions-entry" })
					dispatchUi({ action: { entry, kind: "rename" }, type: "set-text-action" })
				}}
				submitting={uiState.submitting}
			/>
			<MoveEntrySheet
				destinations={moveDestinations}
				entry={uiState.moveEntry}
				error={uiState.moveError}
				onDismiss={() => {
					if (!uiState.submitting) {
						dispatchUi({ entry: null, type: "set-move-entry" })
					}
				}}
				onMove={(targetParentPath) => {
					void handleMoveEntry(targetParentPath)
				}}
				submitting={uiState.submitting}
				textColor={colors.label}
			/>
			<TextActionSheet
				key={`${uiState.textAction?.kind ?? "none"}:${textInitialValue}`}
				action={uiState.textAction}
				error={uiState.textError}
				initialValue={textInitialValue}
				onDismiss={() => {
					if (!uiState.submitting) {
						dispatchUi({ action: null, type: "set-text-action" })
					}
				}}
				onSubmit={(value) => {
					void handleSubmitTextAction(value)
				}}
				submitting={uiState.submitting}
			/>
		</View>
	)

	return {
		drawerBackgroundColor: staticColors.groupedBackground,
		drawerWidth,
		renderSidebar,
	}
}

export function MobileSidebarProvider({ children }: PropsWithChildren) {
	const drawerRef = useRef<DrawerLayout>(null)

	function closeSidebar() {
		drawerRef.current?.closeDrawer()
	}

	function openSidebar() {
		drawerRef.current?.openDrawer()
	}

	const { drawerBackgroundColor, drawerWidth, renderSidebar } =
		useMobileSidebarDrawer(closeSidebar)

	return (
		<MobileSidebarContext.Provider value={{ closeSidebar, openSidebar }}>
			<DrawerLayout
				ref={drawerRef}
				drawerBackgroundColor={drawerBackgroundColor}
				drawerLockMode="unlocked"
				drawerPosition="left"
				drawerType="front"
				drawerWidth={drawerWidth}
				edgeWidth={32}
				keyboardDismissMode="on-drag"
				overlayColor="rgba(0,0,0,0.32)"
				renderNavigationView={renderSidebar}
				useNativeAnimations
			>
				{children}
			</DrawerLayout>
		</MobileSidebarContext.Provider>
	)
}

function WorkspaceSwitcher({
	colors,
	iconColors,
	onPress,
	vaultName,
}: {
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	iconColors: (typeof mobileIconColors)[keyof typeof mobileIconColors]
	onPress: () => void
	vaultName: string
}) {
	return (
		<Pressable
			accessibilityLabel="Switch vault"
			onPress={onPress}
			style={({ pressed }) => [
				styles.workspaceSwitcher,
				{
					backgroundColor: colors.secondaryBackground,
					opacity: pressed ? 0.68 : 1,
				},
			]}
		>
			<FolderOpen color={iconColors.secondary} size={18} strokeWidth={2.2} />
			<Text numberOfLines={1} style={[styles.workspaceName, { color: colors.label }]}>
				{vaultName}
			</Text>
			<ChevronDown color={iconColors.secondary} size={15} strokeWidth={2.2} />
		</Pressable>
	)
}

function SidebarIconButton({
	Icon,
	color,
	label,
	onPress,
}: {
	Icon: LucideIcon
	color: string
	label: string
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityLabel={label}
			hitSlop={6}
			onPress={onPress}
			style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.55 : 1 }]}
		>
			<Icon color={color} size={21} strokeWidth={2.25} />
		</Pressable>
	)
}

function SidebarFileItem({
	active,
	colors,
	depth,
	entry,
	expanded,
	iconColors,
	onLongPress,
	onOpenNote,
	onToggleFolder,
	vaultPath,
}: {
	active: boolean
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	depth: number
	entry: FileEntry
	expanded: boolean
	iconColors: (typeof mobileIconColors)[keyof typeof mobileIconColors]
	onLongPress: (entry: FileEntry) => void
	onOpenNote: (filePath: string) => void
	onToggleFolder: (folderPath: string) => void
	vaultPath?: string
}) {
	const title = getEntryTitle(entry, vaultPath)
	const Icon = entry.isDir ? (expanded ? FolderOpen : Folder) : FileText

	return (
		<Pressable
			onLongPress={() => onLongPress(entry)}
			onPress={() => {
				if (entry.isDir) onToggleFolder(entry.path)
				else onOpenNote(entry.path)
			}}
			style={({ pressed }) => [
				styles.fileRow,
				{
					backgroundColor: active ? colors.secondaryBackground : "transparent",
					marginLeft: depth * 15,
					opacity: pressed ? 0.58 : 1,
				},
			]}
		>
			{entry.isDir ? (
				<ChevronRight
					color={iconColors.secondary}
					size={15}
					style={[styles.disclosure, expanded ? styles.disclosureOpen : null]}
				/>
			) : (
				<View style={styles.disclosurePlaceholder} />
			)}
			<Icon color={active ? iconColors.tint : iconColors.secondary} size={18} strokeWidth={2.15} />
			<Text numberOfLines={1} style={[styles.fileRowText, { color: colors.label }]}>
				{title}
			</Text>
		</Pressable>
	)
}

function WorkspaceSwitcherSheet({
	activeVaultUuid,
	isPresented,
	onBrowseVault,
	onDismiss,
	onOpenRecentVault,
	recentVaults,
	submitting,
}: {
	activeVaultUuid: string | null
	isPresented: boolean
	onBrowseVault: () => void
	onDismiss: () => void
	onOpenRecentVault: (entry: VaultRegistryEntry) => void
	recentVaults: VaultRegistryEntry[]
	submitting: boolean
}) {
	return (
		<Host>
			<BottomSheet isPresented={isPresented} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={10} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title="Vaults">
							<ListItem supportingText="Open a recent vault or browse for another folder.">
								Switch vault
							</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<ExpoButton disabled={submitting} label="Browse folder" onPress={onBrowseVault} />
					{recentVaults.map((entry) => (
						<ExpoButton
							disabled={submitting || entry.uuid === activeVaultUuid}
							key={entry.uuid}
							label={`${entry.uuid === activeVaultUuid ? "Current: " : ""}${entry.name}`}
							onPress={() => onOpenRecentVault(entry)}
							variant="outlined"
						/>
					))}
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

function MoreActionsSheet({
	allFoldersExpanded,
	isPresented,
	onDismiss,
	onExpandCollapseAll,
	onRefresh,
}: {
	allFoldersExpanded: boolean
	isPresented: boolean
	onDismiss: () => void
	onExpandCollapseAll: () => void
	onRefresh: () => void
}) {
	return (
		<Host>
			<BottomSheet isPresented={isPresented} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={10} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title="Files">
							<ListItem supportingText="Quick actions for the mobile file explorer.">
								Explorer options
							</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<SheetActionButton
						Icon={allFoldersExpanded ? ChevronsUp : ChevronsDown}
						label={allFoldersExpanded ? "Collapse all folders" : "Expand all folders"}
						onPress={onExpandCollapseAll}
					/>
					<SheetActionButton Icon={RefreshCw} label="Refresh" onPress={onRefresh} />
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
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
	submitting,
}: {
	entry: FileEntry | null
	onDelete: (entry: FileEntry) => void
	onDismiss: () => void
	onDuplicate: (entry: FileEntry) => void
	onMove: (entry: FileEntry) => void
	onRename: (entry: FileEntry) => void
	submitting: boolean
}) {
	return (
		<Host>
			<BottomSheet isPresented={entry !== null} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={10} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title={entry?.isDir ? "Folder actions" : "Note actions"}>
							<ListItem supportingText={entry?.path ?? ""}>{entry?.name ?? ""}</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<SheetActionButton
						Icon={Edit2}
						disabled={submitting}
						label="Rename"
						onPress={() => {
							if (entry) onRename(entry)
						}}
					/>
					<SheetActionButton
						Icon={Move}
						disabled={submitting}
						label="Move"
						onPress={() => {
							if (entry) onMove(entry)
						}}
					/>
					{entry && isMarkdownEntry(entry) ? (
						<SheetActionButton
							Icon={Copy}
							disabled={submitting}
							label="Duplicate"
							onPress={() => onDuplicate(entry)}
						/>
					) : null}
					<SheetActionButton
						Icon={Trash2}
						destructive
						disabled={submitting}
						label="Delete"
						onPress={() => {
							if (entry) onDelete(entry)
						}}
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
}: {
	destinations: MoveDestination[]
	entry: FileEntry | null
	error: string | null
	onDismiss: () => void
	onMove: (targetParentPath: string) => void
	submitting: boolean
	textColor: ColorValue
}) {
	const currentParentPath = entry ? getParentPath(entry.path) : null

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
						renderItem={({ item }) => (
							<MoveDestinationRow
								disabled={submitting || currentParentPath === item.path}
								label={item.label}
								onMove={onMove}
								path={item.path}
								textColor={textColor}
							/>
						)}
						style={styles.moveList}
					/>
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

function TextActionSheet({
	action,
	error,
	initialValue,
	onDismiss,
	onSubmit,
	submitting,
}: {
	action: TextSheetAction
	error: string | null
	initialValue: string
	onDismiss: () => void
	onSubmit: (value: string) => void
	submitting: boolean
}) {
	const draftRef = useRef(initialValue)
	const [validationError, setValidationError] = useState<string | null>(null)
	const title = getTextActionTitle(action)

	function handleSubmit() {
		const value = draftRef.current.trim()
		const nextValidationError = validateTextActionName(action, value)
		if (nextValidationError) {
			setValidationError(nextValidationError)
			return
		}
		onSubmit(value)
	}

	return (
		<Host>
			<BottomSheet isPresented={action !== null} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={12} style={styles.sheetContent}>
					<FieldGroup>
						<FieldGroup.Section title={title}>
							<ListItem supportingText={validationError ?? error ?? "Saved inside this vault."}>
								{title}
							</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					<MobileTextField
						autoCapitalize="sentences"
						autoCorrect={false}
						autoFocus
						defaultValue={initialValue}
						error={validationError ?? error}
						onChangeText={(value) => {
							draftRef.current = value
							setValidationError(null)
						}}
						onSubmitText={(value) => {
							draftRef.current = value
							handleSubmit()
						}}
						placeholder={getTextActionPlaceholder(action)}
						returnKeyType="done"
					/>
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

function SheetActionButton({
	Icon,
	destructive,
	disabled,
	label,
	onPress,
}: {
	Icon: LucideIcon
	destructive?: boolean
	disabled?: boolean
	label: string
	onPress: () => void
}) {
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const iconColors = mobileIconColors[scheme]
	const color = destructive ? colors.destructive : iconColors.tint

	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.sheetAction,
				{
					borderColor: colors.separator,
					opacity: disabled ? 0.42 : pressed ? 0.62 : 1,
				},
			]}
		>
			<Icon color={color as string} size={19} strokeWidth={2.25} />
			<Text style={[styles.sheetActionText, { color: destructive ? colors.destructive : colors.label }]}>
				{label}
			</Text>
		</Pressable>
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

const styles = StyleSheet.create({
	actionBar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		paddingBottom: 12,
		paddingHorizontal: 16,
	},
	actionButton: {
		alignItems: "center",
		borderRadius: 8,
		height: 34,
		justifyContent: "center",
		width: 34,
	},
	closeButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 36,
		minWidth: 36,
	},
	disclosure: {
		transform: [{ rotate: "0deg" }],
	},
	disclosureOpen: {
		transform: [{ rotate: "90deg" }],
	},
	disclosurePlaceholder: {
		width: 15,
	},
	emptySidebar: {
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 18,
	},
	emptySidebarText: {
		fontSize: 14,
		letterSpacing: 0,
		lineHeight: 20,
	},
	emptySidebarTitle: {
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 21,
	},
	fileList: {
		flex: 1,
	},
	fileListContent: {
		paddingBottom: 16,
		paddingHorizontal: 8,
	},
	fileRow: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 8,
		minHeight: 36,
		paddingHorizontal: 10,
	},
	fileRowText: {
		flex: 1,
		fontSize: 15,
		fontWeight: "500",
		letterSpacing: 0,
		lineHeight: 20,
		minWidth: 0,
	},
	headerIconButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 32,
		minWidth: 32,
	},
	moveDestination: {
		borderRadius: 8,
		justifyContent: "center",
		minHeight: 44,
		paddingHorizontal: 12,
	},
	moveDestinationText: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
	},
	moveList: {
		maxHeight: 280,
	},
	sheetAction: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		minHeight: 44,
		paddingHorizontal: 12,
	},
	sheetActionText: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
	},
	sheetContent: {
		padding: 16,
	},
	sidebar: {
		flex: 1,
		paddingTop: 56,
	},
	topBar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		paddingBottom: 12,
		paddingHorizontal: 16,
	},
	workspaceName: {
		flex: 1,
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
		minWidth: 0,
	},
	workspaceSwitcher: {
		alignItems: "center",
		borderRadius: 8,
		flex: 1,
		flexDirection: "row",
		gap: 8,
		minHeight: 42,
		paddingHorizontal: 12,
	},
})
