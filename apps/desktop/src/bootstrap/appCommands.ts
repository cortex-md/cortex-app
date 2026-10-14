import { type CommandEntry, type CommandExecutionContext, registerCommands } from "@cortex/commands"
import {
	canReadVaultPath,
	createDatabaseCommandEntries,
	createFileCommandEntries,
	type EditorMode,
	type RightSidebarPanel,
	reportAppError,
	useAppStore,
	useBookmarksStore,
	useEditorStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { createEditorCommandEntries } from "@cortex/editor/editor-command-entries"
import { createMarkdownFormatCommandEntries } from "@cortex/editor/markdown-format-commands"
import type { EditorCommand, EditorRuntimeView } from "@cortex/editor/types"
import { getPlatform } from "@cortex/platform"
import { getEditorViewRef } from "@cortex/plugin-host-core"
import { type FontScaleStep, stepFontSizes, useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	BookmarkIcon,
	CalendarCheckIcon,
	CircleCheckIcon,
	ClipboardCopyIcon,
	CloudOffIcon,
	Columns2Icon,
	ExternalLinkIcon,
	FolderIcon,
	HistoryIcon,
	LayoutTemplateIcon,
	PanelLeftIcon,
	PanelRightIcon,
	PencilIcon,
	PinIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	Share2Icon,
	StoreIcon,
	SunMoonIcon,
	Table2Icon,
	TagIcon,
	TerminalIcon,
	TrashIcon,
	UploadIcon,
	UsersIcon,
	XIcon,
} from "lucide-react"
import { checkForAppUpdate } from "../features/app-updates/appUpdateStore"
import { openChangelogTab } from "../features/app-updates/openChangelog"
import { commentCommands } from "../features/comments/commentCommands"
import { insertDrawingBlock } from "../features/drawings/drawingCommands"
import { copyFilePath, toggleSyncExclusion } from "../features/file-explorer/fileActions"
import {
	FILE_EXPLORER_COMMAND_IDS,
	runFileExplorerCommand,
} from "../features/file-explorer/fileExplorerCommands"
import {
	exportNoteFromDialog,
	importFilesFromDialog,
} from "../features/import-export/importExportActions"
import { importObsidianVaultFromDialog } from "../features/import-export/obsidianImport"
import { openMarketplaceView } from "../features/marketplace/openMarketplaceView"
import { manageAccessModal } from "../features/sync/manageAccessModal"
import { noteHistoryModal } from "../features/sync/noteHistoryModal"
import { noteShareModal } from "../features/sync/noteShareModal"
import { deletedNotesModal, syncLogsModal } from "../features/sync/syncDialogStores"
import { openTasksSidebar, openTodayView } from "../features/tasks/taskModel"
import { openNewTemplate, openTemplatesView } from "../features/templates/templateActions"
import { openAddVault } from "../features/vault/vaultActions"

const HELP_URLS = {
	docs: "https://github.com/cortex-md/cortex-app#readme",
	issues: "https://github.com/cortex-md/cortex-app/issues/new",
} as const

const EDITOR_TOGGLE_SETTINGS = [
	"wordWrap",
	"showLineNumbers",
	"vimMode",
	"folding",
	"markdownToolbar",
	"slashCommands",
] as const

type EditorToggleSetting = (typeof EDITOR_TOGGLE_SETTINGS)[number]

const EDITOR_MODES: readonly EditorMode[] = ["source", "live-preview", "reading", "side-by-side"]
const COLOR_SCHEMES = ["light", "dark", "system"] as const

function setEditorMode(context: CommandExecutionContext): void {
	const mode = getPayloadString(context, "mode")
	if (mode && EDITOR_MODES.includes(mode as EditorMode)) {
		useEditorStore.getState().setMode(mode as EditorMode)
	}
}

function toggleEditorSetting(context: CommandExecutionContext): void {
	const key = getPayloadString(context, "key")
	if (!key || !EDITOR_TOGGLE_SETTINGS.includes(key as EditorToggleSetting)) return
	const settings = useSettingsStore.getState()
	const editorKey = key as EditorToggleSetting
	void settings.updateSetting("editor", editorKey, !settings.settings.editor[editorKey])
}

function setColorScheme(context: CommandExecutionContext): void {
	const scheme = getPayloadString(context, "scheme")
	if (scheme && COLOR_SCHEMES.includes(scheme as (typeof COLOR_SCHEMES)[number])) {
		void useSettingsStore.getState().updateSetting("appearance", "colorscheme", scheme)
	}
}

function scaleFonts(step: FontScaleStep): void {
	const settings = useSettingsStore.getState()
	const next = stepFontSizes(settings.settings.appearance, step)
	void settings.updateSetting("appearance", "uiFontSize", next.uiFontSize)
	void settings.updateSetting("appearance", "editorFontSize", next.editorFontSize)
}

function openRightSidebarPanel(panel: RightSidebarPanel): void {
	useUIStore.getState().setRightSidebarLayout({ collapsed: false, panel })
}

function openWhatsNew(): void {
	const version = useAppStore.getState().version
	if (version) void openChangelogTab(version)
}

const NEXT_MODE: Record<EditorMode, EditorMode> = {
	source: "live-preview",
	"live-preview": "reading",
	reading: "side-by-side",
	"side-by-side": "source",
}

type CommandPayload = Record<string, unknown>

function getPayload(context: CommandExecutionContext): CommandPayload {
	return context.payload && typeof context.payload === "object"
		? (context.payload as CommandPayload)
		: {}
}

function getPayloadString(context: CommandExecutionContext, key: string): string | null {
	const value = getPayload(context)[key]
	return typeof value === "string" ? value : null
}

function getTargetFilePath(context: CommandExecutionContext): string | null {
	return getPayloadString(context, "filePath") ?? useEditorStore.getState().activeFilePath
}

function withTargetFile(run: (filePath: string, context: CommandExecutionContext) => unknown) {
	return (context: CommandExecutionContext) => {
		const filePath = getTargetFilePath(context)
		if (filePath) void run(filePath, context)
	}
}

interface TabTarget {
	tabId: string
	paneId: string
}

function getTargetTab(context: CommandExecutionContext): TabTarget | null {
	const workspace = useWorkspaceStore.getState()
	const paneId = getPayloadString(context, "paneId") ?? workspace.activePaneId
	const tabId = getPayloadString(context, "tabId") ?? workspace.panes[paneId]?.activeTabId
	return tabId ? { tabId, paneId } : null
}

function closeTabs(context: CommandExecutionContext, scope: "others" | "right"): void {
	const target = getTargetTab(context)
	if (target) useWorkspaceStore.getState().closeOtherTabs(target.tabId, target.paneId, scope)
}

function navigateHistory(context: CommandExecutionContext, direction: -1 | 1): void {
	const workspace = useWorkspaceStore.getState()
	const paneId = getPayloadString(context, "paneId") ?? workspace.activePaneId
	workspace.navigateHistory(paneId, direction)
}

function runEditorCommand(command: EditorCommand): void {
	const view = getEditorViewRef() as EditorRuntimeView | null
	if (!view) return
	void command(view)
}

function openSidebarView(viewId: string): void {
	const ui = useUIStore.getState()
	if (ui.leftSidebarCollapsed) ui.toggleLeftSidebar()
	ui.setLeftSidebarView(viewId)
}

async function toggleBookmark(context: CommandExecutionContext): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	const filePath = getTargetFilePath(context)
	if (!vaultPath || !filePath) return
	try {
		await useBookmarksStore.getState().toggleBookmark(vaultPath, filePath)
	} catch (error) {
		await reportAppError({
			operation: "toggle-bookmark",
			source: "app-command",
			cause: error,
			userMessage: "The bookmark could not be updated.",
			context: { filePath },
		})
	}
}

async function exportActiveNote(context: CommandExecutionContext, format: "html" | "pdf" | "csv") {
	const filePath = getTargetFilePath(context)
	if (!filePath) return
	await exportNoteFromDialog(
		filePath,
		format,
		context.source === "menu" ? "context-menu" : "command-palette",
	)
}

function closeTargetTab(context: CommandExecutionContext): void {
	const target = getTargetTab(context)
	if (target) useWorkspaceStore.getState().closeTab(target.tabId, target.paneId)
}

function toggleEditorMode(): void {
	const editor = useEditorStore.getState()
	editor.setMode(NEXT_MODE[editor.mode])
}

function toggleThemeScheme(): void {
	const themeManager = getThemeManager()
	const themeName = useSettingsStore.getState().settings.appearance.theme
	const currentIsDark = themeManager.getActiveTheme().isDark
	themeManager.setActiveTheme(
		themeManager.resolveTheme(themeName, currentIsDark ? "light" : "dark"),
	)
}

const editorCommands: CommandEntry[] = [
	...createEditorCommandEntries(runEditorCommand),
	...createMarkdownFormatCommandEntries(runEditorCommand),
	{
		id: "format.drawing",
		label: "Insert Drawing",
		category: "Format",
		aliases: ["insert-drawing", "drawing", "draw", "excalidraw", "whiteboard"],
		execute: () =>
			runEditorCommand((view) =>
				insertDrawingBlock(view, useEditorStore.getState().activeFilePath),
			),
	},
]

const appCommands: CommandEntry[] = [
	...createFileCommandEntries({
		openFile: (filePath) => useWorkspaceStore.getState().openTab(filePath),
	}),
	...createDatabaseCommandEntries({ icon: Table2Icon }),
	{
		id: "vault.open",
		label: "Open Vault",
		category: "Vault",
		aliases: ["open-vault"],
		execute: () => openAddVault({ start: "open" }),
	},
	{
		id: "vault.add",
		label: "Add Vault…",
		category: "Vault",
		aliases: ["new-vault", "create-vault", "download-vault"],
		execute: () => openAddVault(),
	},
	{
		id: "vault.close",
		label: "Close Vault",
		category: "Vault",
		aliases: ["close-vault"],
		execute: () => void useVaultStore.getState().closeVault(),
	},
	{
		id: "file.close-tab",
		label: "Close Tab",
		category: "File",
		aliases: ["close-tab"],
		icon: XIcon,
		hotkey: { defaultKeys: "mod+w", scope: "global" },
		execute: closeTargetTab,
	},
	{
		id: "tabs.close-others",
		label: "Close Other Tabs",
		category: "File",
		aliases: ["close-other-tabs"],
		execute: (context) => closeTabs(context, "others"),
	},
	{
		id: "tabs.close-to-right",
		label: "Close Tabs to the Right",
		category: "File",
		aliases: ["close-tabs-right"],
		execute: (context) => closeTabs(context, "right"),
	},
	{
		id: "tabs.toggle-pin",
		label: "Toggle Pin Tab",
		category: "File",
		aliases: ["pin-tab"],
		icon: PinIcon,
		execute: (context) => {
			const target = getTargetTab(context)
			if (target) useWorkspaceStore.getState().pinTab(target.tabId, target.paneId)
		},
	},
	{
		id: "file.open-in-new-tab",
		label: "Open in New Tab",
		category: "File",
		aliases: ["open-new-tab"],
		icon: ExternalLinkIcon,
		execute: withTargetFile((filePath) =>
			useWorkspaceStore.getState().openTab(filePath, { forceNew: true }),
		),
	},
	{
		id: "file.open-in-right-split",
		label: "Open in Right Split",
		category: "File",
		aliases: ["open-right-split", "split-right"],
		icon: Columns2Icon,
		execute: withTargetFile((filePath, context) => {
			const workspace = useWorkspaceStore.getState()
			const paneId = getPayloadString(context, "paneId") ?? workspace.activePaneId
			workspace.openInSplit(filePath, paneId, "horizontal")
		}),
	},
	{
		id: "file.copy-relative-path",
		label: "Copy Relative Path",
		category: "File",
		aliases: ["copy-path"],
		icon: ClipboardCopyIcon,
		execute: withTargetFile((filePath) => copyFilePath(filePath, "relative")),
	},
	{
		id: "file.copy-absolute-path",
		label: "Copy Absolute Path",
		category: "File",
		aliases: ["copy-absolute-path"],
		icon: ClipboardCopyIcon,
		execute: withTargetFile((filePath) => copyFilePath(filePath, "absolute")),
	},
	{
		id: "file.reveal",
		label: "Reveal in Finder",
		category: "File",
		aliases: ["reveal", "show-in-explorer"],
		icon: FolderIcon,
		execute: withTargetFile((filePath) => getPlatform().dialog.revealFolder(filePath)),
	},
	{
		id: "sync.show-version-history",
		label: "Version History",
		category: "File",
		aliases: ["version-history", "note-history"],
		icon: HistoryIcon,
		execute: withTargetFile((filePath) => {
			if (canReadVaultPath(filePath)) noteHistoryModal.open({ filePath })
		}),
	},
	{
		id: "sync.share-note",
		label: "Share Note",
		category: "Sync",
		aliases: ["share", "public-link", "share-note"],
		icon: Share2Icon,
		execute: withTargetFile((filePath) => noteShareModal.open({ filePath })),
	},
	{
		id: "sync.manage-access",
		label: "Manage Access",
		category: "Sync",
		aliases: ["manage-access", "permissions", "share-folder"],
		icon: UsersIcon,
		execute: withTargetFile((filePath, context) => {
			const isDirectory =
				getPayload(context).isDirectory === true ||
				(useVaultStore.getState().files.find((file) => file.path === filePath)?.isDir ?? false)
			if (isDirectory) manageAccessModal.open({ filePath })
			else noteShareModal.open({ filePath })
		}),
	},
	{
		id: "sync.toggle-excluded",
		label: "Toggle Sync Exclusion",
		category: "Sync",
		aliases: ["exclude-from-sync", "include-in-sync"],
		icon: CloudOffIcon,
		execute: withTargetFile((filePath, context) =>
			toggleSyncExclusion(filePath, getPayload(context).isDirectory === true),
		),
	},
	{
		id: "file.reopen-closed",
		label: "Reopen Closed Tab",
		category: "File",
		aliases: ["reopen-closed-tab"],
		hotkey: { defaultKeys: "mod+shift+t", scope: "global" },
		execute: () => useWorkspaceStore.getState().reopenLastClosed(),
	},
	{
		id: "import.files",
		label: "Import Files",
		category: "Import / Export",
		aliases: ["import", "import-files", "batch-import"],
		icon: UploadIcon,
		execute: () => void importFilesFromDialog("command-palette"),
	},
	{
		id: "import.obsidian",
		label: "Import from Obsidian",
		category: "Import / Export",
		aliases: ["import-obsidian", "obsidian"],
		icon: UploadIcon,
		execute: () => void importObsidianVaultFromDialog(),
	},
	{
		id: "export.active-html",
		label: "Export Active Note as HTML",
		category: "Import / Export",
		aliases: ["export-html", "export-note-html"],
		execute: (context) => void exportActiveNote(context, "html"),
	},
	{
		id: "export.active-pdf",
		label: "Export Active Note as PDF",
		category: "Import / Export",
		aliases: ["export-pdf", "export-note-pdf"],
		execute: (context) => void exportActiveNote(context, "pdf"),
	},
	{
		id: "export.active-csv",
		label: "Export Active Note as CSV",
		category: "Import / Export",
		aliases: ["export-csv", "export-note-csv"],
		execute: (context) => void exportActiveNote(context, "csv"),
	},
	{
		id: "navigate.quick-finder",
		label: "Quick Finder",
		category: "Navigate",
		aliases: ["quick-finder", "open-note"],
		icon: SearchIcon,
		hotkey: { defaultKeys: "mod+o", scope: "global" },
		execute: () => useUIStore.getState().toggleQuickFinder(),
	},
	{
		id: "navigate.command-palette",
		label: "Command Palette",
		category: "Navigate",
		aliases: ["command-palette", "commands"],
		icon: TerminalIcon,
		hotkey: { defaultKeys: "mod+p", scope: "global" },
		execute: () => useUIStore.getState().toggleCommandPalette(),
	},
	{
		id: "navigate.mru-next",
		label: "Next Tab (MRU)",
		category: "Navigate",
		aliases: ["next-tab"],
		hotkey: { defaultKeys: "mod+Tab", scope: "global" },
		execute: () => useWorkspaceStore.getState().navigateMRU(1),
	},
	{
		id: "navigate.mru-prev",
		label: "Previous Tab (MRU)",
		category: "Navigate",
		aliases: ["previous-tab"],
		hotkey: { defaultKeys: "mod+shift+Tab", scope: "global" },
		execute: () => useWorkspaceStore.getState().navigateMRU(-1),
	},
	{
		id: "navigate.back",
		label: "Go Back",
		category: "Navigate",
		aliases: ["back", "history-back"],
		icon: ArrowLeftIcon,
		hotkey: { defaultKeys: "mod+alt+ArrowLeft", scope: "global" },
		execute: (context) => navigateHistory(context, -1),
	},
	{
		id: "navigate.forward",
		label: "Go Forward",
		category: "Navigate",
		aliases: ["forward", "history-forward"],
		icon: ArrowRightIcon,
		hotkey: { defaultKeys: "mod+alt+ArrowRight", scope: "global" },
		execute: (context) => navigateHistory(context, 1),
	},
	{
		id: "tabs.new",
		label: "New Tab",
		category: "File",
		aliases: ["new-tab"],
		icon: PlusIcon,
		execute: () => useUIStore.getState().openQuickFinder(),
	},
	{
		id: "view.toggle-right-sidebar",
		label: "Toggle Right Sidebar",
		category: "View",
		aliases: ["right-sidebar", "outline", "backlinks"],
		icon: PanelRightIcon,
		hotkey: { defaultKeys: "mod+]", scope: "global" },
		execute: () => useUIStore.getState().toggleRightSidebar(),
	},
	{
		id: "view.toggle-sidebar",
		label: "Toggle Sidebar",
		category: "View",
		aliases: ["toggle-sidebar"],
		icon: PanelLeftIcon,
		hotkey: { defaultKeys: "mod+[", scope: "global" },
		execute: () => useUIStore.getState().toggleLeftSidebar(),
	},
	{
		id: "view.files",
		label: "Show Files",
		category: "View",
		aliases: ["files", "file-explorer"],
		execute: () => openSidebarView("files"),
	},
	{
		id: "view.search",
		label: "Search in Vault",
		category: "Navigate",
		aliases: ["search-vault", "find-in-vault"],
		icon: SearchIcon,
		hotkey: { defaultKeys: "mod+shift+f", scope: "global" },
		execute: () => openSidebarView("search"),
	},
	{
		id: "view.bookmarks",
		label: "Show Bookmarks",
		category: "View",
		aliases: ["bookmarks"],
		icon: BookmarkIcon,
		execute: () => openSidebarView("bookmarks"),
	},
	{
		id: "bookmarks.toggle",
		label: "Toggle Bookmark",
		category: "Bookmarks",
		aliases: ["bookmark", "favorite", "toggle-bookmark"],
		icon: BookmarkIcon,
		hotkey: { defaultKeys: "mod+shift+b", scope: "global" },
		execute: (context) => void toggleBookmark(context),
	},
	{
		id: "view.tags",
		label: "Show Tags",
		category: "View",
		aliases: ["tags"],
		execute: () => openSidebarView("tags"),
	},
	{
		id: "view.tasks",
		label: "Show Tasks",
		category: "View",
		aliases: ["tasks", "todos"],
		icon: CircleCheckIcon,
		execute: () => openTasksSidebar(),
	},
	{
		id: "tasks.add",
		label: "Add Task",
		category: "Tasks",
		aliases: ["add-task", "new-task", "todo"],
		icon: PlusIcon,
		hotkey: { defaultKeys: "mod+shift+a", scope: "global" },
		execute: () => openTasksSidebar(true),
	},
	{
		id: "tasks.open-today",
		label: "Open Today",
		category: "Tasks",
		aliases: ["today", "upcoming", "agenda"],
		icon: CalendarCheckIcon,
		hotkey: { defaultKeys: "mod+shift+y", scope: "global" },
		execute: () => openTodayView(),
	},
	{
		id: "view.toggle-theme",
		label: "Toggle Colorscheme",
		category: "View",
		aliases: ["toggle-theme", "toggle-colorscheme"],
		icon: SunMoonIcon,
		execute: toggleThemeScheme,
	},
	{
		id: "app.settings",
		label: "Open Settings",
		category: "App",
		aliases: ["settings", "open-settings"],
		icon: SettingsIcon,
		hotkey: { defaultKeys: "mod+,", scope: "global" },
		execute: () => useUIStore.getState().openSettings(),
	},
	{
		id: "marketplace.open",
		label: "Open Marketplace",
		category: "App",
		aliases: ["marketplace", "browse-plugins", "browse-themes"],
		icon: StoreIcon,
		execute: () => openMarketplaceView("plugins"),
	},
	{
		id: "marketplace.open-plugins",
		label: "Browse Plugins",
		category: "App",
		aliases: ["plugins-marketplace", "browse-plugins"],
		icon: StoreIcon,
		execute: () => openMarketplaceView("plugins"),
	},
	{
		id: "marketplace.open-themes",
		label: "Browse Themes",
		category: "App",
		aliases: ["themes-marketplace", "browse-themes"],
		icon: StoreIcon,
		execute: () => openMarketplaceView("themes"),
	},
	{
		id: "tags.toggle-picker",
		label: "Tag Picker",
		category: "Tags",
		aliases: ["tag-picker"],
		icon: TagIcon,
		hotkey: { defaultKeys: "mod+t", scope: "global" },
		execute: () => useUIStore.getState().toggleTagPicker(),
	},
	{
		id: FILE_EXPLORER_COMMAND_IDS.openMenu,
		label: "Open File Menu",
		category: "File Explorer",
		aliases: ["file-menu", "open-file-menu"],
		hotkey: { defaultKeys: "shift+F10", scope: "file-explorer" },
		execute: (context) =>
			runFileExplorerCommand(
				FILE_EXPLORER_COMMAND_IDS.openMenu,
				getPayloadString(context, "filePath"),
			),
	},
	{
		id: FILE_EXPLORER_COMMAND_IDS.rename,
		label: "Rename File",
		category: "File Explorer",
		aliases: ["rename-file"],
		icon: PencilIcon,
		hotkey: { defaultKeys: "F2", scope: "file-explorer" },
		execute: (context) =>
			runFileExplorerCommand(
				FILE_EXPLORER_COMMAND_IDS.rename,
				getPayloadString(context, "filePath"),
			),
	},
	{
		id: FILE_EXPLORER_COMMAND_IDS.delete,
		label: "Delete File",
		category: "File Explorer",
		aliases: ["delete-file"],
		icon: TrashIcon,
		hotkey: { defaultKeys: "Delete", scope: "file-explorer" },
		execute: (context) =>
			runFileExplorerCommand(
				FILE_EXPLORER_COMMAND_IDS.delete,
				getPayloadString(context, "filePath"),
			),
	},
	{
		id: "templates.create-note",
		label: "New note from template",
		category: "Templates",
		aliases: ["template", "new-from-template"],
		icon: LayoutTemplateIcon,
		execute: () => {
			if (useVaultStore.getState().vault) useUIStore.getState().openCreateFromTemplate()
		},
	},
	{
		id: "templates.manage",
		label: "Open Templates",
		category: "Templates",
		aliases: ["templates", "manage-templates"],
		icon: LayoutTemplateIcon,
		execute: () => openTemplatesView(),
	},
	{
		id: "templates.new",
		label: "New template",
		category: "Templates",
		aliases: ["create-template", "add-template"],
		icon: LayoutTemplateIcon,
		execute: () => openNewTemplate({ start: "blank" }),
	},
	{
		id: "templates.save-note-as-template",
		label: "Save note as template",
		category: "Templates",
		aliases: ["save-as-template", "template-from-note"],
		icon: LayoutTemplateIcon,
		execute: (context) => {
			const notePath =
				getPayloadString(context, "filePath") ?? useEditorStore.getState().activeFilePath
			if (notePath?.endsWith(".md")) openNewTemplate({ start: "note", notePath })
		},
	},
	{
		id: "editor.toggle-mode",
		label: "Toggle Editor Mode",
		category: "Editor",
		aliases: ["toggle-editor-mode"],
		hotkey: { defaultKeys: "mod+e", scope: "global" },
		execute: toggleEditorMode,
	},
	{
		id: "window.new",
		label: "New Window",
		category: "Window",
		aliases: ["new-window"],
		hotkey: { defaultKeys: "mod+shift+n", scope: "global" },
		execute: () => void getPlatform().window.openNewWindow(),
	},
	{
		id: "app.check-updates",
		label: "Check for Updates",
		category: "App",
		aliases: ["update", "check-updates"],
		execute: () => void checkForAppUpdate("manual"),
	},
	{
		id: "app.whats-new",
		label: "What's New",
		category: "Help",
		aliases: ["changelog", "release-notes"],
		execute: openWhatsNew,
	},
	{
		id: "help.open-docs",
		label: "Cortex Help",
		category: "Help",
		aliases: ["docs", "documentation"],
		execute: () => void getPlatform().app.openExternalUrl(HELP_URLS.docs),
	},
	{
		id: "help.report-issue",
		label: "Report an Issue",
		category: "Help",
		aliases: ["bug", "feedback"],
		execute: () => void getPlatform().app.openExternalUrl(HELP_URLS.issues),
	},
	{
		id: "help.keyboard-shortcuts",
		label: "Keyboard Shortcuts",
		category: "Help",
		aliases: ["hotkeys", "shortcuts"],
		execute: () => useUIStore.getState().openSettings("hotkeys"),
	},
	{
		id: "sync.now",
		label: "Sync Now",
		category: "Sync",
		aliases: ["sync", "restart-sync"],
		execute: () => void useSyncStore.getState().restartSync(),
	},
	{
		id: "sync.open-logs",
		label: "Sync Logs",
		category: "Sync",
		aliases: ["sync-logs"],
		execute: () => syncLogsModal.open(true),
	},
	{
		id: "sync.open-deleted",
		label: "Deleted Notes",
		category: "Sync",
		aliases: ["trash", "restore-deleted"],
		execute: () => deletedNotesModal.open(true),
	},
	{
		id: "sync.settings",
		label: "Sync Settings",
		category: "Sync",
		execute: () => useUIStore.getState().openSettings("sync"),
	},
	{
		id: "view.zoom-in",
		label: "Zoom In",
		category: "View",
		aliases: ["increase-font-size"],
		hotkey: { defaultKeys: "mod+=", scope: "global" },
		execute: () => scaleFonts(1),
	},
	{
		id: "view.zoom-out",
		label: "Zoom Out",
		category: "View",
		aliases: ["decrease-font-size"],
		hotkey: { defaultKeys: "mod+-", scope: "global" },
		execute: () => scaleFonts(-1),
	},
	{
		id: "view.zoom-reset",
		label: "Actual Size",
		category: "View",
		aliases: ["reset-font-size"],
		hotkey: { defaultKeys: "mod+0", scope: "global" },
		execute: () => scaleFonts(0),
	},
	{
		id: "view.outline",
		label: "Show Outline",
		category: "View",
		aliases: ["outline"],
		execute: () => openRightSidebarPanel("outline"),
	},
	{
		id: "view.backlinks",
		label: "Show Backlinks",
		category: "View",
		aliases: ["backlinks"],
		execute: () => openRightSidebarPanel("backlinks"),
	},
	{
		id: "editor.set-mode",
		label: "Set Editor Mode",
		category: "Editor",
		execute: setEditorMode,
	},
	{
		id: "editor.toggle-setting",
		label: "Toggle Editor Setting",
		category: "Editor",
		execute: toggleEditorSetting,
	},
	{
		id: "appearance.set-colorscheme",
		label: "Set Colorscheme",
		category: "View",
		execute: setColorScheme,
	},
	...Array.from({ length: 9 }, (_, index) => ({
		id: `navigate.tab-${index + 1}`,
		label: `Go to Tab ${index + 1}`,
		category: "Navigate",
		aliases: [`tab-${index + 1}`],
		hotkey: { defaultKeys: `mod+${index + 1}`, scope: "global" as const },
		execute: () => useWorkspaceStore.getState().goToTabIndex(index),
	})),
]

export function registerAppCommands(): () => void {
	return registerCommands([...appCommands, ...commentCommands, ...editorCommands])
}
