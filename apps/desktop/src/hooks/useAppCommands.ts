import { type CommandEntry, type CommandExecutionContext, registerCommand } from "@cortex/commands"
import {
	type EditorMode,
	useBookmarksStore,
	useEditorStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import {
	addTableColumnEnd,
	addTableColumnLeft,
	addTableColumnRight,
	addTableRowAbove,
	addTableRowBelow,
	addTableRowEnd,
	alignTableColumnCenter,
	alignTableColumnLeft,
	alignTableColumnRight,
	clearTableCell,
	clearTableSelection,
	copyLine,
	copyTableColumnTsv,
	copyTableMarkdown,
	copyTableRowTsv,
	copyTableSelectionTsv,
	copyTableTsv,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	duplicateLine,
	duplicateTableColumn,
	duplicateTableRow,
	moveTableColumnLeft,
	moveTableColumnRight,
	moveTableRowDown,
	moveTableRowUp,
} from "@cortex/editor/commands"
import {
	foldAllRanges,
	toggleFoldAtSelection,
	unfoldAllRanges,
	unfoldCurrentFold,
} from "@cortex/editor/folding-commands"
import { createMarkdownFormatCommandEntries } from "@cortex/editor/markdown-format-commands"
import { openFindPanel } from "@cortex/editor/search-commands"
import type { EditorCommand, EditorRuntimeView } from "@cortex/editor/types"
import { getPlatform } from "@cortex/platform"
import { getEditorViewRef } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"
import {
	BookmarkIcon,
	CalendarIcon,
	FileIcon,
	LayoutTemplateIcon,
	PanelLeftIcon,
	PencilIcon,
	SearchIcon,
	SettingsIcon,
	StoreIcon,
	SunMoonIcon,
	TagIcon,
	TerminalIcon,
	TrashIcon,
} from "lucide-react"
import { useEffect } from "react"
import {
	dispatchFileExplorerCommand,
	FILE_EXPLORER_COMMAND_IDS,
} from "../features/file-explorer/fileExplorerCommands"
import { openMarketplaceView } from "../features/marketplace/openMarketplaceView"
import { reportAppError } from "../utils/reportAppError"

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

async function openNewNote(context: CommandExecutionContext): Promise<void> {
	const vaultState = useVaultStore.getState()
	const vaultPath = vaultState.vault?.path
	if (!vaultPath) return
	const parentPath = getPayloadString(context, "parentPath") ?? vaultPath
	try {
		const filePath = await vaultState.createFile(parentPath, "Untitled")
		useWorkspaceStore.getState().openTab(filePath)
	} catch (error) {
		await reportAppError({
			operation: "create-new-note",
			source: "app-command",
			cause: error,
			userMessage: "The note could not be created.",
		})
	}
}

async function openDailyNote(): Promise<void> {
	try {
		const filePath = await useVaultStore.getState().openDailyNote()
		if (filePath) useWorkspaceStore.getState().openTab(filePath)
	} catch (error) {
		await reportAppError({
			operation: "open-daily-note",
			source: "app-command",
			cause: error,
			userMessage: "The daily note could not be opened.",
		})
	}
}

async function toggleBookmark(context: CommandExecutionContext): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	const filePath = getPayloadString(context, "filePath") ?? useEditorStore.getState().activeFilePath
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

function closeActiveTab(): void {
	const workspace = useWorkspaceStore.getState()
	const activeTabId = workspace.panes[workspace.activePaneId]?.activeTabId
	if (activeTabId) workspace.closeTab(activeTabId, workspace.activePaneId)
}

async function openVaultFromDialog(): Promise<void> {
	const vaultPath = await getPlatform().dialog.pickFolder()
	if (!vaultPath) return
	const vaultState = useVaultStore.getState()
	const existingVault = vaultState.recentVaults.find(
		(recentVault) => recentVault.path === vaultPath,
	)
	await vaultState.closeVault()
	await vaultState.openVault(
		vaultPath,
		existingVault ? undefined : { name: vaultPath.split("/").pop() ?? vaultPath },
	)
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

const markdownFormatCommands: CommandEntry[] = [
	{
		id: "editor.find",
		label: "Find in File",
		category: "Editor",
		aliases: ["find"],
		hotkey: { defaultKeys: "mod+f", scope: "editor" },
		execute: () => runEditorCommand(openFindPanel),
	},
	{
		id: "editor.toggle-fold",
		label: "Toggle Fold",
		category: "Editor",
		aliases: ["fold", "toggle-fold"],
		hotkey: { defaultKeys: "mod+alt+[", scope: "editor" },
		execute: () => runEditorCommand(toggleFoldAtSelection),
	},
	{
		id: "editor.unfold-current",
		label: "Unfold Current Fold",
		category: "Editor",
		aliases: ["unfold", "unfold-current"],
		hotkey: { defaultKeys: "mod+alt+]", scope: "editor" },
		execute: () => runEditorCommand(unfoldCurrentFold),
	},
	{
		id: "editor.fold-all",
		label: "Fold All",
		category: "Editor",
		aliases: ["fold-all"],
		execute: () => runEditorCommand(foldAllRanges),
	},
	{
		id: "editor.unfold-all",
		label: "Unfold All",
		category: "Editor",
		aliases: ["unfold-all"],
		execute: () => runEditorCommand(unfoldAllRanges),
	},
	...createMarkdownFormatCommandEntries((command) => runEditorCommand(command)),
	{
		id: "editor.copy-line",
		label: "Copy Line",
		category: "Editor",
		aliases: ["copy-line"],
		execute: () => runEditorCommand(copyLine),
	},
	{
		id: "editor.duplicate-line",
		label: "Duplicate Line",
		category: "Editor",
		aliases: ["duplicate-line"],
		execute: () => runEditorCommand(duplicateLine),
	},
]

const tableCommands: CommandEntry[] = [
	{
		id: "table.add-row-above",
		label: "Add Row Above",
		category: "Table",
		aliases: ["add-row-above", "table-row-above"],
		execute: () => runEditorCommand(addTableRowAbove),
	},
	{
		id: "table.add-row-below",
		label: "Add Row Below",
		category: "Table",
		aliases: ["add-row-below", "table-row-below"],
		hotkey: { defaultKeys: "mod+enter", scope: "editor" },
		execute: () => runEditorCommand(addTableRowBelow),
	},
	{
		id: "table.add-row-end",
		label: "Add Row at End",
		category: "Table",
		aliases: ["add-row-end", "table-row-end"],
		execute: () => runEditorCommand(addTableRowEnd),
	},
	{
		id: "table.add-column-left",
		label: "Add Column Left",
		category: "Table",
		aliases: ["add-column-left", "table-column-left"],
		execute: () => runEditorCommand(addTableColumnLeft),
	},
	{
		id: "table.add-column-right",
		label: "Add Column Right",
		category: "Table",
		aliases: ["add-column-right", "table-column-right"],
		execute: () => runEditorCommand(addTableColumnRight),
	},
	{
		id: "table.add-column-end",
		label: "Add Column at End",
		category: "Table",
		aliases: ["add-column-end", "table-column-end"],
		execute: () => runEditorCommand(addTableColumnEnd),
	},
	{
		id: "table.align-left",
		label: "Align Column Left",
		category: "Table",
		aliases: ["align-column-left", "table-align-left"],
		execute: () => runEditorCommand(alignTableColumnLeft),
	},
	{
		id: "table.align-center",
		label: "Align Column Center",
		category: "Table",
		aliases: ["align-column-center", "table-align-center"],
		execute: () => runEditorCommand(alignTableColumnCenter),
	},
	{
		id: "table.align-right",
		label: "Align Column Right",
		category: "Table",
		aliases: ["align-column-right", "table-align-right"],
		execute: () => runEditorCommand(alignTableColumnRight),
	},
	{
		id: "table.duplicate-row",
		label: "Duplicate Row",
		category: "Table",
		aliases: ["duplicate-row", "table-duplicate-row"],
		execute: () => runEditorCommand(duplicateTableRow),
	},
	{
		id: "table.duplicate-column",
		label: "Duplicate Column",
		category: "Table",
		aliases: ["duplicate-column", "table-duplicate-column"],
		execute: () => runEditorCommand(duplicateTableColumn),
	},
	{
		id: "table.move-row-up",
		label: "Move Row Up",
		category: "Table",
		aliases: ["move-row-up", "table-move-row-up"],
		execute: () => runEditorCommand(moveTableRowUp),
	},
	{
		id: "table.move-row-down",
		label: "Move Row Down",
		category: "Table",
		aliases: ["move-row-down", "table-move-row-down"],
		execute: () => runEditorCommand(moveTableRowDown),
	},
	{
		id: "table.move-column-left",
		label: "Move Column Left",
		category: "Table",
		aliases: ["move-column-left", "table-move-column-left"],
		execute: () => runEditorCommand(moveTableColumnLeft),
	},
	{
		id: "table.move-column-right",
		label: "Move Column Right",
		category: "Table",
		aliases: ["move-column-right", "table-move-column-right"],
		execute: () => runEditorCommand(moveTableColumnRight),
	},
	{
		id: "table.copy-markdown",
		label: "Copy Table as Markdown",
		category: "Table",
		aliases: ["copy-table-markdown", "table-copy-markdown"],
		execute: () => runEditorCommand(copyTableMarkdown),
	},
	{
		id: "table.copy-tsv",
		label: "Copy Table as TSV",
		category: "Table",
		aliases: ["copy-table-tsv", "table-copy-tsv"],
		execute: () => runEditorCommand(copyTableTsv),
	},
	{
		id: "table.copy-row-tsv",
		label: "Copy Row as TSV",
		category: "Table",
		aliases: ["copy-row-tsv", "table-copy-row-tsv"],
		execute: () => runEditorCommand(copyTableRowTsv),
	},
	{
		id: "table.copy-column-tsv",
		label: "Copy Column as TSV",
		category: "Table",
		aliases: ["copy-column-tsv", "table-copy-column-tsv"],
		execute: () => runEditorCommand(copyTableColumnTsv),
	},
	{
		id: "table.copy-selection-tsv",
		label: "Copy Selection as TSV",
		category: "Table",
		aliases: ["copy-selection-tsv", "table-copy-selection-tsv"],
		execute: () => runEditorCommand(copyTableSelectionTsv),
	},
	{
		id: "table.delete-row",
		label: "Delete Row",
		category: "Table",
		aliases: ["delete-row", "table-delete-row"],
		execute: () => runEditorCommand(deleteTableRow),
	},
	{
		id: "table.delete-column",
		label: "Delete Column",
		category: "Table",
		aliases: ["delete-column", "table-delete-column"],
		execute: () => runEditorCommand(deleteTableColumn),
	},
	{
		id: "table.clear-cell",
		label: "Clear Cell",
		category: "Table",
		aliases: ["clear-cell", "table-clear-cell"],
		execute: () => runEditorCommand(clearTableCell),
	},
	{
		id: "table.clear-selection",
		label: "Clear Selection",
		category: "Table",
		aliases: ["clear-selection", "table-clear-selection"],
		execute: () => runEditorCommand(clearTableSelection),
	},
	{
		id: "table.delete",
		label: "Delete Table",
		category: "Table",
		aliases: ["delete-table"],
		execute: () => runEditorCommand(deleteTable),
	},
]

const appCommands: CommandEntry[] = [
	{
		id: "vault.open",
		label: "Open Vault",
		category: "Vault",
		aliases: ["open-vault"],
		execute: () => void openVaultFromDialog(),
	},
	{
		id: "vault.close",
		label: "Close Vault",
		category: "Vault",
		aliases: ["close-vault"],
		execute: () => void useVaultStore.getState().closeVault(),
	},
	{
		id: "file.new",
		label: "New Note",
		category: "File",
		aliases: ["new-note"],
		icon: FileIcon,
		hotkey: { defaultKeys: "mod+n", scope: "global" },
		execute: (context) => void openNewNote(context),
	},
	{
		id: "file.close-tab",
		label: "Close Tab",
		category: "File",
		aliases: ["close-tab"],
		hotkey: { defaultKeys: "mod+w", scope: "global" },
		execute: closeActiveTab,
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
		id: "navigate.daily-note",
		label: "Open Daily Note",
		category: "Navigate",
		aliases: ["daily-note", "today"],
		icon: CalendarIcon,
		hotkey: { defaultKeys: "mod+d", scope: "global" },
		execute: () => void openDailyNote(),
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
		id: "view.toggle-theme",
		label: "Toggle Colorscheme",
		category: "View",
		aliases: ["toggle-theme", "toggle-colorscheme"],
		icon: SunMoonIcon,
		hotkey: { defaultKeys: "mod+shift+d", scope: "global" },
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
		execute: () => dispatchFileExplorerCommand(FILE_EXPLORER_COMMAND_IDS.openMenu),
	},
	{
		id: FILE_EXPLORER_COMMAND_IDS.rename,
		label: "Rename File",
		category: "File Explorer",
		aliases: ["rename-file"],
		icon: PencilIcon,
		hotkey: { defaultKeys: "F2", scope: "file-explorer" },
		execute: () => dispatchFileExplorerCommand(FILE_EXPLORER_COMMAND_IDS.rename),
	},
	{
		id: FILE_EXPLORER_COMMAND_IDS.delete,
		label: "Delete File",
		category: "File Explorer",
		aliases: ["delete-file"],
		icon: TrashIcon,
		hotkey: { defaultKeys: "Delete", scope: "file-explorer" },
		execute: () => dispatchFileExplorerCommand(FILE_EXPLORER_COMMAND_IDS.delete),
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
		label: "Manage templates",
		category: "Templates",
		aliases: ["templates", "manage-templates"],
		icon: LayoutTemplateIcon,
		execute: () => useUIStore.getState().openSettings("templates"),
	},
	{
		id: "editor.toggle-mode",
		label: "Toggle Editor Mode",
		category: "Editor",
		aliases: ["toggle-editor-mode"],
		hotkey: { defaultKeys: "mod+e", scope: "global" },
		execute: toggleEditorMode,
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

export function useAppCommands(): void {
	useEffect(() => {
		const unregister = [...appCommands, ...markdownFormatCommands, ...tableCommands].map(
			(command) => registerCommand(command),
		)
		return () => {
			for (const unregisterCommand of unregister) unregisterCommand()
		}
	}, [])
}
