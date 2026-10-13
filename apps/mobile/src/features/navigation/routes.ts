import { useWorkspaceStore } from "@cortex/core"
import { type Href, router } from "expo-router"

export type SettingsPage =
	| "general"
	| "vaults"
	| "appearance"
	| "editor"
	| "hotkeys"
	| "templates"
	| "import-export"
	| "notifications"
	| "plugins"
	| "plugin-settings"
	| "marketplace"
	| "marketplace-detail"
	| "marketplace-readme"
	| "plan"
	| "sync"
	| "sync/prefs"
	| "sync/members"
	| "sync/self-hosted"
	| "sync/link"
	| "sync-logs"
	| "deleted-notes"
	| "deleted-note"

export type SheetName =
	| "properties"
	| "outline"
	| "comments"
	| "people"
	| "export"
	| "vault-switcher"
	| "add-vault"
	| "quick-finder"
	| "command-palette"
	| "task"
	| "from-template"
	| "import"
	| "share-template"
	| "db-view-options"
	| "db-new"
	| "tabs"
	| "rename"
	| "new-folder"

type Params = Record<string, string | number | undefined>

function href(pathname: string, params?: Params): Href {
	return { params, pathname } as Href
}

export function openNote(filePath: string): void {
	useWorkspaceStore.getState().openTab(filePath, { reuseActive: true })
	router.push(href("/note", { filePath }))
}

export function openFolder(path: string): void {
	router.push(href("/folder", { path }))
}

export function openDatabase(folderPath: string, view?: string): void {
	router.push(href("/database", { folderPath, view }))
}

export function openTagPage(tag: string): void {
	router.push(href("/tag", { tag }))
}

export function openTask(taskId: string): void {
	presentSheet("task", { taskId })
}

export function openPluginViewRoute(viewKey: string): void {
	router.push(href("/plugin-view", { viewKey }))
}

export function openTemplateEditor(filePath: string): void {
	router.push(href("/template-editor", { filePath }))
}

export function openConflict(filePath: string): void {
	router.push(href("/conflict", { filePath }))
}

export function openVersionHistory(filePath?: string): void {
	router.push(href("/version-history", { filePath }))
}

export function openVersion(filePath: string, versionId: string): void {
	router.push(href("/version", { filePath, versionId }))
}

export function openSettings(page?: SettingsPage, params?: Params): void {
	router.push(href(page ? `/settings/${page}` : "/settings", params))
}

export function presentSheet(name: SheetName, params?: Params): void {
	router.push(href(`/${name}`, params))
}

export function openOnboarding(params?: Params): void {
	router.push(href("/onboarding", params))
}

export function goToFilesRoot(): void {
	router.replace(href("/(tabs)/(files)"))
}

export function dismissSheet(): void {
	if (router.canGoBack()) router.back()
}
