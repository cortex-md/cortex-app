import { type CommandEntry, registerCommands } from "@cortex/commands"
import {
	createFileCommandEntries,
	type EditorMode,
	type NavigationDirection,
	useBookmarksStore,
	useEditorStore,
	useSyncStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { getThemeManager } from "@cortex/theme"
import { type Href, router } from "expo-router"

import { toast } from "@/features/feedback/useToast"
import {
	openNote,
	openSettings,
	openVersionHistory,
	presentSheet,
	showActiveTab,
} from "@/features/navigation/routes"

const NEXT_MODE: Record<EditorMode, EditorMode> = {
	source: "live-preview",
	"live-preview": "reading",
	reading: "source",
	"side-by-side": "source",
}

export function openMobileNote(filePath: string): void {
	openNote(filePath)
}

function activeTarget(): { paneId: string; tabId: string; filePath: string | null } | null {
	const { activePaneId, panes } = useWorkspaceStore.getState()
	const pane = panes[activePaneId]
	const tab = pane?.tabs.find((candidate) => candidate.id === pane.activeTabId)
	if (!tab) return null
	return {
		paneId: activePaneId,
		tabId: tab.id,
		filePath: tab.tabType === "file" ? tab.filePath : null,
	}
}

function withActiveTab(run: (target: { paneId: string; tabId: string }) => void): () => void {
	return () => {
		const target = activeTarget()
		if (target) run(target)
	}
}

function withActiveFile(run: (filePath: string) => void | Promise<void>): () => void {
	return () => {
		const filePath = activeTarget()?.filePath ?? useEditorStore.getState().activeFilePath
		if (filePath) void run(filePath)
		else toast("Open a note first")
	}
}

function navigateHistory(direction: NavigationDirection): void {
	const { activePaneId, navigateHistory: navigate } = useWorkspaceStore.getState()
	navigate(activePaneId, direction)
	showActiveTab()
}

function goToTab(segment: string): void {
	router.navigate(`/(tabs)/${segment}` as Href)
}

function toggleThemeScheme(): void {
	const themeManager = getThemeManager()
	const active = themeManager.getActiveTheme()
	themeManager.setActiveTheme(
		themeManager.resolveTheme(active.name, active.isDark ? "light" : "dark"),
	)
}

async function openDailyNote(): Promise<void> {
	const filePath = await useVaultStore.getState().openDailyNote()
	if (filePath) openNote(filePath)
}

async function copyRelativePath(filePath: string): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	const relativePath = vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
	await getPlatform().clipboard.writeText(relativePath ?? filePath)
	toast("Path copied")
}

async function toggleBookmark(filePath: string): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	const result = await useBookmarksStore.getState().toggleBookmark(vaultPath, filePath)
	toast(result.bookmarked ? "Bookmarked" : "Removed bookmark")
}

const mobileAppCommands: CommandEntry[] = [
	...createFileCommandEntries({ openFile: openMobileNote }),
	{
		id: "vault.add",
		label: "Add Vault…",
		category: "Vault",
		aliases: ["new-vault", "create-vault", "download-vault"],
		execute: () => presentSheet("add-vault"),
	},
	{
		id: "vault.switch",
		label: "Switch Vault",
		category: "Vault",
		aliases: ["vaults", "switch-vault"],
		execute: () => presentSheet("vault-switcher"),
	},
	{
		id: "file.close-tab",
		label: "Close Tab",
		category: "File",
		aliases: ["close-tab"],
		execute: withActiveTab(({ paneId, tabId }) => {
			useWorkspaceStore.getState().closeTab(tabId, paneId)
			showActiveTab()
		}),
	},
	{
		id: "tabs.close-others",
		label: "Close Other Tabs",
		category: "File",
		aliases: ["close-others"],
		execute: withActiveTab(({ paneId, tabId }) =>
			useWorkspaceStore.getState().closeOtherTabs(tabId, paneId),
		),
	},
	{
		id: "tabs.close-to-right",
		label: "Close Tabs to the Right",
		category: "File",
		aliases: ["close-right"],
		execute: withActiveTab(({ paneId, tabId }) =>
			useWorkspaceStore.getState().closeOtherTabs(tabId, paneId, "right"),
		),
	},
	{
		id: "tabs.toggle-pin",
		label: "Pin / Unpin Tab",
		category: "File",
		aliases: ["pin-tab", "unpin-tab"],
		execute: withActiveTab(({ paneId, tabId }) =>
			useWorkspaceStore.getState().pinTab(tabId, paneId),
		),
	},
	{
		id: "file.reopen-closed",
		label: "Reopen Closed Tab",
		category: "File",
		aliases: ["reopen-closed-tab"],
		execute: () => {
			useWorkspaceStore.getState().reopenLastClosed()
			showActiveTab()
		},
	},
	{
		id: "tabs.show",
		label: "Show Open Tabs",
		category: "File",
		aliases: ["tabs", "open-tabs"],
		execute: () => presentSheet("tabs"),
	},
	{
		id: "tabs.new",
		label: "New Tab",
		category: "File",
		aliases: ["new-tab"],
		execute: () => presentSheet("quick-finder"),
	},
	{
		id: "file.copy-relative-path",
		label: "Copy Relative Path",
		category: "File",
		aliases: ["copy-path"],
		execute: withActiveFile(copyRelativePath),
	},
	{
		id: "navigate.quick-finder",
		label: "Quick Finder",
		category: "Navigate",
		aliases: ["quick-finder", "open-note"],
		execute: () => presentSheet("quick-finder"),
	},
	{
		id: "navigate.mru-next",
		label: "Next Tab (MRU)",
		category: "Navigate",
		aliases: ["next-tab"],
		execute: () => {
			useWorkspaceStore.getState().navigateMRU(1)
			showActiveTab()
		},
	},
	{
		id: "navigate.mru-prev",
		label: "Previous Tab (MRU)",
		category: "Navigate",
		aliases: ["previous-tab"],
		execute: () => {
			useWorkspaceStore.getState().navigateMRU(-1)
			showActiveTab()
		},
	},
	{
		id: "navigate.back",
		label: "Go Back",
		category: "Navigate",
		aliases: ["back", "history-back"],
		execute: () => navigateHistory(-1),
	},
	{
		id: "navigate.forward",
		label: "Go Forward",
		category: "Navigate",
		aliases: ["forward", "history-forward"],
		execute: () => navigateHistory(1),
	},
	{
		id: "daily.open",
		label: "Open Today's Daily Note",
		category: "Navigate",
		aliases: ["daily", "daily-note", "today-note"],
		execute: () => void openDailyNote(),
	},
	{
		id: "view.files",
		label: "Show Files",
		category: "View",
		aliases: ["files", "explorer"],
		execute: () => goToTab("(files)"),
	},
	{
		id: "view.search",
		label: "Search Vault",
		category: "View",
		aliases: ["search", "find-in-vault"],
		execute: () => goToTab("(search)"),
	},
	{
		id: "view.bookmarks",
		label: "Show Bookmarks",
		category: "View",
		aliases: ["bookmarks"],
		execute: () => goToTab("(bookmarks)"),
	},
	{
		id: "view.tags",
		label: "Show Tags",
		category: "View",
		aliases: ["tags"],
		execute: () => goToTab("(tags)"),
	},
	{
		id: "view.tasks",
		label: "Show Today",
		category: "View",
		aliases: ["tasks", "today"],
		execute: () => goToTab("(today)"),
	},
	{
		id: "view.outline",
		label: "Show Outline",
		category: "View",
		aliases: ["outline", "headings"],
		execute: withActiveFile(() => presentSheet("outline")),
	},
	{
		id: "view.toggle-theme",
		label: "Toggle Light / Dark Theme",
		category: "View",
		aliases: ["theme", "dark-mode", "light-mode"],
		execute: toggleThemeScheme,
	},
	{
		id: "bookmarks.toggle",
		label: "Bookmark / Unbookmark Note",
		category: "File",
		aliases: ["bookmark"],
		execute: withActiveFile(toggleBookmark),
	},
	{
		id: "tasks.add",
		label: "Add Task",
		category: "Tasks",
		aliases: ["new-task", "quick-add"],
		execute: () => router.push("/quick-add" as Href),
	},
	{
		id: "editor.toggle-mode",
		label: "Toggle Editor Mode",
		category: "Editor",
		aliases: ["reading-mode", "source-mode", "live-preview"],
		execute: () => {
			const editor = useEditorStore.getState()
			editor.setMode(NEXT_MODE[editor.mode])
		},
	},
	{
		id: "templates.create-note",
		label: "New Note from Template",
		category: "Templates",
		aliases: ["from-template", "template"],
		execute: () => presentSheet("from-template"),
	},
	{
		id: "templates.manage",
		label: "Manage Templates",
		category: "Templates",
		aliases: ["templates"],
		execute: () => openSettings("templates"),
	},
	{
		id: "sync.show-version-history",
		label: "Show Version History",
		category: "Sync",
		aliases: ["history", "versions"],
		execute: withActiveFile((filePath) => openVersionHistory(filePath)),
	},
	{
		id: "sync.now",
		label: "Sync Now",
		category: "Sync",
		aliases: ["sync"],
		execute: () => void useSyncStore.getState().restartSync(),
	},
	{
		id: "sync.open-logs",
		label: "Open Sync Logs",
		category: "Sync",
		aliases: ["sync-logs", "logs"],
		execute: () => openSettings("sync-logs"),
	},
	{
		id: "sync.open-deleted",
		label: "Show Deleted Notes",
		category: "Sync",
		aliases: ["trash", "deleted"],
		execute: () => openSettings("deleted-notes"),
	},
	{
		id: "sync.settings",
		label: "Sync Settings",
		category: "Sync",
		aliases: ["sync-settings"],
		execute: () => openSettings("sync"),
	},
	{
		id: "app.settings",
		label: "Open Settings",
		category: "App",
		aliases: ["settings", "preferences"],
		execute: () => openSettings(),
	},
	{
		id: "marketplace.open",
		label: "Open Marketplace",
		category: "App",
		aliases: ["marketplace", "store"],
		execute: () => openSettings("marketplace"),
	},
	{
		id: "marketplace.open-plugins",
		label: "Browse Plugins",
		category: "App",
		aliases: ["plugins"],
		execute: () => openSettings("marketplace", { tab: "plugins" }),
	},
	{
		id: "marketplace.open-themes",
		label: "Browse Themes",
		category: "App",
		aliases: ["themes"],
		execute: () => openSettings("marketplace", { tab: "themes" }),
	},
]

export function registerMobileAppCommands(): () => void {
	return registerCommands(mobileAppCommands)
}
