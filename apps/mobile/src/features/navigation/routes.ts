import { useWorkspaceStore } from "@cortex/core"
import { type Href, router } from "expo-router"
import { store } from "expo-router/build/global-state/router-store"

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

interface RouteStateNode {
	index?: number
	routes: { name: string; state?: RouteStateNode }[]
}

function findTabsState(state: RouteStateNode | undefined): RouteStateNode | undefined {
	if (!state) return undefined
	for (const route of state.routes) {
		if (route.name === "(tabs)") return route.state
		const nested = findTabsState(route.state)
		if (nested) return nested
	}
	return undefined
}

function focusedLeafName(state: RouteStateNode | undefined): string | undefined {
	let current = state
	let name: string | undefined
	while (current && current.routes.length > 0) {
		const route = current.routes[current.index ?? current.routes.length - 1]
		if (!route) return name
		name = route.name
		current = route.state
	}
	return name
}

function isNoteOnTop(): boolean {
	const navigation = store.navigationRef.current
	if (!navigation?.isReady()) return false
	const root = navigation.getRootState() as unknown as RouteStateNode
	const name = focusedLeafName(findTabsState(root))
	return name === "note" || name?.endsWith("/note") === true
}

export function openNote(filePath: string): void {
	useWorkspaceStore.getState().openTab(filePath, { reuseActive: true })
	const target = href("/note", { filePath })
	if (isNoteOnTop()) router.replace(target)
	else router.push(target)
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
