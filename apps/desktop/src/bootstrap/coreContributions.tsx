import { CORE_OWNER, type ContributionSet, registerContributions } from "@cortex/plugin-host-core"
import { BookmarkIcon, CircleCheckIcon, FolderClosed, SearchIcon, TagIcon } from "lucide-react"
import { type ComponentType, lazy } from "react"
import { BookmarksSidebar } from "../features/bookmarks/BookmarksSidebar"
import { DATABASE_VIEW_ID } from "../features/databases/databaseWorkspace"
import { DRAWING_BOARD_VIEW_ID } from "../features/drawings/drawingDocument"
import { FileSidebar } from "../features/file-explorer/FileSidebar"
import { MARKETPLACE_VIEW_ID } from "../features/marketplace/marketplaceWorkspaceView"
import { MERMAID_DIAGRAM_VIEW_ID } from "../features/mermaid/mermaidDocument"
import { PluginMarkdownNoteView } from "../features/plugins/PluginMarkdownNoteView"
import { PLUGIN_MARKDOWN_NOTE_VIEW_ID } from "../features/plugins/pluginMarkdownNote"
import { SearchSidebar } from "../features/search/SearchSidebar"
import {
	StatusBarCursor,
	StatusBarModeButton,
	StatusBarWordCount,
} from "../features/statusbar/StatusBar"
import { SyncIndicator } from "../features/sync/SyncIndicator"
import { SHARED_NOTE_VIEW_ID } from "../features/sync/sharedNote"
import { SYNC_WELCOME_VIEW_ID } from "../features/sync/syncWelcome"
import { TagsSidebar } from "../features/tags/TagsSidebar"
import { TAG_VIEW_ID } from "../features/tags/tagWorkspaceView"
import { TasksSidebar } from "../features/tasks/TasksSidebar"
import { TASKS_SIDEBAR_VIEW_ID, TODAY_VIEW_ID } from "../features/tasks/taskModel"

function lazyView<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
	return lazy(() => load().then((module) => ({ default: module[name] as ComponentType })))
}

const LazyMarketplaceView = lazyView(
	() => import("../features/marketplace/MarketplaceView"),
	"MarketplaceView",
)
const LazyAppUpdateChangelogView = lazyView(
	() => import("../features/app-updates/AppUpdateChangelogView"),
	"AppUpdateChangelogView",
)
const LazyDrawingBoardView = lazyView(
	() => import("../features/drawings/DrawingBoardView"),
	"DrawingBoardView",
)
const LazyMermaidDiagramView = lazyView(
	() => import("../features/mermaid/MermaidDiagramView"),
	"MermaidDiagramView",
)
const LazySyncWelcomeView = lazyView(
	() => import("../features/sync/SyncWelcomeView"),
	"SyncWelcomeView",
)
const LazySharedNoteView = lazyView(
	() => import("../features/sync/SharedNoteView"),
	"SharedNoteView",
)
const LazyDatabaseView = lazyView(
	() => import("../features/databases/DatabaseView"),
	"DatabaseView",
)
const LazyTagPageView = lazyView(() => import("../features/tags/TagPageView"), "TagPageView")
const LazyTodayView = lazyView(() => import("../features/tasks/TodayView"), "TodayView")

const coreSidebarViews = [
	{ id: "files", label: "Files", icon: FolderClosed, component: FileSidebar },
	{ id: "search", label: "Search", icon: SearchIcon, component: SearchSidebar },
	{ id: "bookmarks", label: "Bookmarks", icon: BookmarkIcon, component: BookmarksSidebar },
	{ id: "tags", label: "Tags", icon: TagIcon, component: TagsSidebar },
	{ id: TASKS_SIDEBAR_VIEW_ID, label: "Tasks", icon: CircleCheckIcon, component: TasksSidebar },
]

const coreTabViews: Record<string, unknown> = {
	"app-update-changelog": LazyAppUpdateChangelogView,
	[SYNC_WELCOME_VIEW_ID]: LazySyncWelcomeView,
	[SHARED_NOTE_VIEW_ID]: LazySharedNoteView,
	[MARKETPLACE_VIEW_ID]: LazyMarketplaceView,
	[PLUGIN_MARKDOWN_NOTE_VIEW_ID]: PluginMarkdownNoteView,
	[DRAWING_BOARD_VIEW_ID]: LazyDrawingBoardView,
	[MERMAID_DIAGRAM_VIEW_ID]: LazyMermaidDiagramView,
	[TAG_VIEW_ID]: LazyTagPageView,
	[TODAY_VIEW_ID]: LazyTodayView,
	[DATABASE_VIEW_ID]: LazyDatabaseView,
}

const coreContributions: ContributionSet = {
	views: [
		...coreSidebarViews.map((view) => ({
			...view,
			location: "sidebar-left" as const,
			initialState: {},
		})),
		...Object.entries(coreTabViews).map(([id, component]) => ({
			id,
			label: id,
			icon: id,
			location: "tab" as const,
			initialState: {},
			component,
		})),
	],
	sidebarItems: coreSidebarViews.map(({ id, label, icon }) => ({ id, label, icon, viewKey: id })),
	statusBarItems: [
		{ id: "sync", position: "right", priority: 100, component: SyncIndicator },
		{ id: "words", position: "right", priority: 0, component: StatusBarWordCount },
		{ id: "cursor", position: "right", priority: -10, component: StatusBarCursor },
		{ id: "editor-mode", position: "right", priority: -20, component: StatusBarModeButton },
	],
}

export function registerCoreContributions(): () => void {
	return registerContributions(CORE_OWNER, coreContributions)
}
