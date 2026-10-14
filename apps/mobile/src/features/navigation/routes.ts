import { noteCache, type Tab, useWorkspaceStore } from "@cortex/core"
import { replacePathPrefix } from "@cortex/platform/utils"
import { type Href, router, useFocusEffect } from "expo-router"
import { store } from "expo-router/build/global-state/router-store"
import { useCallback } from "react"

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

interface RouteNode {
	key?: string
	name: string
	params?: object
	state?: RouteStateNode
}

interface RouteStateNode {
	index?: number
	key?: string
	routes: RouteNode[]
}

export interface OpenNoteOptions {
	reuseActive?: boolean
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

function focusedLeaf(state: RouteStateNode | undefined): RouteNode | undefined {
	let current = state
	let leaf: RouteNode | undefined
	while (current && current.routes.length > 0) {
		const route = current.routes[current.index ?? current.routes.length - 1]
		if (!route) return leaf
		leaf = route
		current = route.state
	}
	return leaf
}

function getRootState(): RouteStateNode | undefined {
	const navigation = store.navigationRef.current
	if (!navigation?.isReady()) return undefined
	return navigation.getRootState() as unknown as RouteStateNode
}

function isNoteRoute(route: RouteNode | undefined): boolean {
	return route?.name === "note" || route?.name.endsWith("/note") === true
}

function routeFilePath(route: RouteNode | undefined): string | null {
	const value = (route?.params as { filePath?: unknown } | undefined)?.filePath
	return typeof value === "string" ? value : null
}

function topNoteRoute(): RouteNode | undefined {
	const leaf = focusedLeaf(findTabsState(getRootState()))
	return isNoteRoute(leaf) ? leaf : undefined
}

function showNoteRoute(filePath: string): void {
	const top = topNoteRoute()
	if (top && routeFilePath(top) === filePath) return
	const target = href("/note", { filePath })
	if (top) router.replace(target)
	else router.push(target)
}

export function openNote(filePath: string, options?: OpenNoteOptions): void {
	useWorkspaceStore
		.getState()
		.openTab(filePath, options?.reuseActive ? { reuseActive: true } : undefined)
	showNoteRoute(filePath)
}

function activeTab(): Tab | null {
	const { activePaneId, panes } = useWorkspaceStore.getState()
	const pane = panes[activePaneId]
	return pane?.tabs.find((tab) => tab.id === pane.activeTabId) ?? null
}

function isTabsFocused(): boolean {
	let current = getRootState()
	while (current && current.routes.length > 0) {
		const route = current.routes[current.index ?? current.routes.length - 1]
		if (!route) return false
		if (route.name === "(tabs)") return true
		current = route.state
	}
	return false
}

export function showActiveTab(): void {
	const tab = activeTab()
	if (tab?.tabType === "view" && tab.viewId) {
		openPluginViewRoute(tab.viewId)
		return
	}
	if (tab?.filePath) {
		showNoteRoute(tab.filePath)
		return
	}
	if (topNoteRoute() && router.canGoBack()) router.back()
}

export function syncNoteWithActiveTab(): void {
	const top = topNoteRoute()
	if (!top || !isTabsFocused()) return
	const tab = activeTab()
	if (tab?.tabType === "file" && tab.filePath === routeFilePath(top)) return
	showActiveTab()
}

export function useActiveNoteTab(filePath: string | null): void {
	useFocusEffect(
		useCallback(() => {
			if (!filePath) return
			const { activateTab, activePaneId, panes } = useWorkspaceStore.getState()
			const pane = panes[activePaneId]
			const tab = pane?.tabs.find(
				(candidate) => candidate.tabType === "file" && candidate.filePath === filePath,
			)
			if (tab && pane && pane.activeTabId !== tab.id) activateTab(tab.id, activePaneId)
		}, [filePath]),
	)
}

function retargetRoutes(state: RouteStateNode | undefined, oldPath: string, newPath: string): void {
	if (!state) return
	for (const route of state.routes) {
		const current = routeFilePath(route)
		const next = current ? replacePathPrefix(current, oldPath, newPath) : null
		if (next && route.key) {
			store.navigationRef.current?.dispatch({
				payload: { params: { filePath: next } },
				source: route.key,
				target: state.key,
				type: "SET_PARAMS",
			})
		}
		retargetRoutes(route.state, oldPath, newPath)
	}
}

export function retargetNoteRoutes(oldPath: string, newPath: string): void {
	if (oldPath === newPath) return
	retargetRoutes(getRootState(), oldPath, newPath)
}

noteCache.onPathChange((oldPath, newPath) => {
	if (newPath) retargetNoteRoutes(oldPath, newPath)
})

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

export function openPdf(filePath: string): void {
	router.push(href("/pdf", { filePath }))
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
