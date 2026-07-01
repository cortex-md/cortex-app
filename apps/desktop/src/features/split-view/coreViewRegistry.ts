import type { ViewTabState } from "@cortex/core"
import type { ComponentType } from "react"
import { AppUpdateChangelogView } from "../app-updates/AppUpdateChangelogView"
import { BookmarksSidebar } from "../bookmarks/BookmarksSidebar"
import { DATABASE_VIEW_ID, DatabaseView } from "../databases/DatabaseView"
import { DrawingBoardView } from "../drawings/DrawingBoardView"
import { DRAWING_BOARD_VIEW_ID } from "../drawings/drawingDocument"
import { FileSidebar } from "../file-explorer/FileSidebar"
import { MarketplaceView } from "../marketplace/MarketplaceView"
import { MARKETPLACE_VIEW_ID } from "../marketplace/marketplaceWorkspaceView"
import { MermaidDiagramView } from "../mermaid/MermaidDiagramView"
import { MERMAID_DIAGRAM_VIEW_ID } from "../mermaid/mermaidDocument"
import { PluginMarkdownNoteView } from "../plugins/PluginMarkdownNoteView"
import { PLUGIN_MARKDOWN_NOTE_VIEW_ID } from "../plugins/pluginMarkdownNote"
import { SearchSidebar } from "../search/SearchSidebar"
import { SyncWelcomeView } from "../sync/SyncWelcomeView"
import { SYNC_WELCOME_VIEW_ID } from "../sync/syncWelcome"
import { TagsSidebar } from "../tags/TagsSidebar"

export interface CoreViewProps {
	viewState: ViewTabState
	onStateChange: (viewState: ViewTabState) => void
	isActive: boolean
}

const CORE_VIEW_COMPONENTS: Record<string, ComponentType<CoreViewProps>> = {
	files: FileSidebar as ComponentType<CoreViewProps>,
	search: SearchSidebar as ComponentType<CoreViewProps>,
	bookmarks: BookmarksSidebar as ComponentType<CoreViewProps>,
	tags: TagsSidebar as ComponentType<CoreViewProps>,
	"app-update-changelog": AppUpdateChangelogView,
	[SYNC_WELCOME_VIEW_ID]: SyncWelcomeView,
	[MARKETPLACE_VIEW_ID]: MarketplaceView,
	[PLUGIN_MARKDOWN_NOTE_VIEW_ID]: PluginMarkdownNoteView,
	[DRAWING_BOARD_VIEW_ID]: DrawingBoardView,
	[MERMAID_DIAGRAM_VIEW_ID]: MermaidDiagramView,
	[DATABASE_VIEW_ID]: DatabaseView,
}

export function getCoreViewComponent(viewId: string): ComponentType<CoreViewProps> | null {
	return CORE_VIEW_COMPONENTS[viewId] ?? null
}
