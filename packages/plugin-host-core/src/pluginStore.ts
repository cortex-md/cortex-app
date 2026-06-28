import type {
	ContextMenuItemRegistration,
	ModalOpenOptions,
	PluginManifest,
	PluginSettingDefinition,
	SettingsTabRegistration,
	SidebarItemRegistration,
	StatusBarItemRegistration,
	ViewRegistration,
} from "@cortex.md/api"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { createStore } from "zustand/vanilla"

export type PluginStatus = "discovered" | "loaded" | "enabled" | "disabled" | "error"

export interface PluginRecord {
	manifest: PluginManifest
	status: PluginStatus
	error?: string
}

export interface PluginModalInstance {
	id: string
	pluginId: string
	viewId: string
	viewKey: string
	title?: string
	state: Record<string, unknown>
}

export interface PluginRegistrationOwner {
	pluginId: string
	registrationKey: string
}

export type RegisteredPluginView = ViewRegistration & PluginRegistrationOwner
export type RegisteredSidebarItem = SidebarItemRegistration & PluginRegistrationOwner
export type RegisteredStatusBarItem = StatusBarItemRegistration & PluginRegistrationOwner
export type RegisteredSettingsTab = SettingsTabRegistration & PluginRegistrationOwner
export type RegisteredContextMenuItem = ContextMenuItemRegistration & PluginRegistrationOwner

export interface PluginStoreState {
	plugins: Record<string, PluginRecord>
	sidebarItems: RegisteredSidebarItem[]
	statusBarItems: RegisteredStatusBarItem[]
	settingsTabs: RegisteredSettingsTab[]
	views: RegisteredPluginView[]
	contextMenuItems: RegisteredContextMenuItem[]
	modalInstances: PluginModalInstance[]
	settingsSchemas: Record<string, PluginSettingDefinition[]>

	setPluginStatus: (pluginId: string, status: PluginStatus, error?: string) => void
	registerPlugin: (manifest: PluginManifest) => void
	unregisterPlugin: (pluginId: string) => void

	addSidebarItem: (pluginId: string, item: SidebarItemRegistration) => void
	removeSidebarItem: (pluginId: string, itemId: string) => void
	addStatusBarItem: (pluginId: string, item: StatusBarItemRegistration) => void
	removeStatusBarItem: (pluginId: string, itemId: string) => void
	addSettingsTab: (pluginId: string, tab: SettingsTabRegistration) => void
	removeSettingsTab: (pluginId: string, tabId: string) => void
	addView: (pluginId: string, view: ViewRegistration) => void
	removeView: (pluginId: string, viewId: string) => void
	addContextMenuItem: (pluginId: string, item: ContextMenuItemRegistration) => void
	removeContextMenuItem: (pluginId: string, itemId: string) => void
	openModal: (pluginId: string, viewId: string, options?: ModalOpenOptions) => string | null
	closeModal: (instanceId: string) => void
	closePluginModal: (pluginId: string, instanceId: string) => void
	updateModalState: (instanceId: string, state: Record<string, unknown>) => void
	setSettingsSchema: (pluginId: string, schema: PluginSettingDefinition[]) => void
	removeSettingsSchema: (pluginId: string) => void
	clearPluginContributions: (pluginId: string) => void

	reset: () => void
}

const initialState = {
	plugins: {} as Record<string, PluginRecord>,
	sidebarItems: [] as RegisteredSidebarItem[],
	statusBarItems: [] as RegisteredStatusBarItem[],
	settingsTabs: [] as RegisteredSettingsTab[],
	views: [] as RegisteredPluginView[],
	contextMenuItems: [] as RegisteredContextMenuItem[],
	modalInstances: [] as PluginModalInstance[],
	settingsSchemas: {} as Record<string, PluginSettingDefinition[]>,
}

let nextModalInstanceId = 0

export function getPluginRegistrationKey(pluginId: string, registrationId: string): string {
	return `${pluginId}:${registrationId}`
}

function ownsRegistration(
	registration: PluginRegistrationOwner & { id: string },
	pluginId: string,
	registrationId: string,
): boolean {
	return registration.pluginId === pluginId && registration.id === registrationId
}

function createOwnedRegistration<T extends { id: string }>(
	pluginId: string,
	registration: T,
): T & PluginRegistrationOwner {
	return {
		...registration,
		pluginId,
		registrationKey: getPluginRegistrationKey(pluginId, registration.id),
	}
}

export const pluginStore = createStore<PluginStoreState>()(
	devtools(
		immer((set) => ({
			...initialState,

			setPluginStatus: (pluginId, status, error) =>
				set((state) => {
					const plugin = state.plugins[pluginId]
					if (plugin) {
						plugin.status = status
						plugin.error = error
					}
				}),

			registerPlugin: (manifest) =>
				set((state) => {
					state.plugins[manifest.id] = { manifest, status: "loaded" }
				}),

			unregisterPlugin: (pluginId) =>
				set((state) => {
					delete state.plugins[pluginId]
					clearPluginContributionsState(state, pluginId)
				}),

			addSidebarItem: (pluginId, item) =>
				set((state) => {
					state.sidebarItems = state.sidebarItems.filter(
						(i) => !ownsRegistration(i, pluginId, item.id),
					)
					state.sidebarItems.push(createOwnedRegistration(pluginId, item))
				}),
			removeSidebarItem: (pluginId, itemId) =>
				set((state) => {
					state.sidebarItems = state.sidebarItems.filter(
						(i) => !ownsRegistration(i, pluginId, itemId),
					)
				}),

			addStatusBarItem: (pluginId, item) =>
				set((state) => {
					state.statusBarItems = state.statusBarItems.filter(
						(i) => !ownsRegistration(i, pluginId, item.id),
					)
					state.statusBarItems.push(createOwnedRegistration(pluginId, item))
				}),
			removeStatusBarItem: (pluginId, itemId) =>
				set((state) => {
					state.statusBarItems = state.statusBarItems.filter(
						(i) => !ownsRegistration(i, pluginId, itemId),
					)
				}),

			addSettingsTab: (pluginId, tab) =>
				set((state) => {
					state.settingsTabs = state.settingsTabs.filter(
						(t) => !ownsRegistration(t, pluginId, tab.id),
					)
					state.settingsTabs.push(createOwnedRegistration(pluginId, tab))
				}),
			removeSettingsTab: (pluginId, tabId) =>
				set((state) => {
					state.settingsTabs = state.settingsTabs.filter(
						(t) => !ownsRegistration(t, pluginId, tabId),
					)
				}),

			addView: (pluginId, view) =>
				set((state) => {
					state.views = state.views.filter((v) => !ownsRegistration(v, pluginId, view.id))
					state.views.push(createOwnedRegistration(pluginId, view))
				}),
			removeView: (pluginId, viewId) =>
				set((state) => {
					const viewKey = getPluginRegistrationKey(pluginId, viewId)
					state.views = state.views.filter((v) => !ownsRegistration(v, pluginId, viewId))
					state.modalInstances = state.modalInstances.filter((modal) => modal.viewKey !== viewKey)
				}),

			addContextMenuItem: (pluginId, item) =>
				set((state) => {
					state.contextMenuItems = state.contextMenuItems.filter(
						(i) => !ownsRegistration(i, pluginId, item.id),
					)
					state.contextMenuItems.push(createOwnedRegistration(pluginId, item))
				}),
			removeContextMenuItem: (pluginId, itemId) =>
				set((state) => {
					state.contextMenuItems = state.contextMenuItems.filter(
						(i) => !ownsRegistration(i, pluginId, itemId),
					)
				}),

			openModal: (pluginId, viewId, options) => {
				let instanceId: string | null = null
				set((state) => {
					const view = state.views.find(
						(candidate) =>
							candidate.pluginId === pluginId &&
							candidate.id === viewId &&
							candidate.location === "modal",
					)
					if (!view) return
					instanceId = `${pluginId}:modal-${nextModalInstanceId++}`
					state.modalInstances.push({
						id: instanceId,
						pluginId,
						viewId,
						viewKey: view.registrationKey,
						title: options?.title,
						state: options?.initialState ?? view.initialState ?? {},
					})
				})
				return instanceId
			},
			closeModal: (instanceId) =>
				set((state) => {
					state.modalInstances = state.modalInstances.filter((modal) => modal.id !== instanceId)
				}),
			closePluginModal: (pluginId, instanceId) =>
				set((state) => {
					state.modalInstances = state.modalInstances.filter(
						(modal) => modal.pluginId !== pluginId || modal.id !== instanceId,
					)
				}),
			updateModalState: (instanceId, modalState) =>
				set((state) => {
					const modal = state.modalInstances.find((candidate) => candidate.id === instanceId)
					if (modal) modal.state = modalState
				}),

			setSettingsSchema: (pluginId, schema) =>
				set((state) => {
					state.settingsSchemas[pluginId] = schema
				}),
			removeSettingsSchema: (pluginId) =>
				set((state) => {
					delete state.settingsSchemas[pluginId]
				}),
			clearPluginContributions: (pluginId) =>
				set((state) => {
					clearPluginContributionsState(state, pluginId)
				}),

			reset: () => {
				nextModalInstanceId = 0
				set(initialState)
			},
		})),
		{ name: "pluginStore" },
	),
)

function clearPluginContributionsState(
	state: Pick<
		PluginStoreState,
		| "sidebarItems"
		| "statusBarItems"
		| "settingsTabs"
		| "views"
		| "contextMenuItems"
		| "modalInstances"
		| "settingsSchemas"
	>,
	pluginId: string,
): void {
	state.sidebarItems = state.sidebarItems.filter((item) => item.pluginId !== pluginId)
	state.statusBarItems = state.statusBarItems.filter((item) => item.pluginId !== pluginId)
	state.settingsTabs = state.settingsTabs.filter((tab) => tab.pluginId !== pluginId)
	state.views = state.views.filter((view) => view.pluginId !== pluginId)
	state.contextMenuItems = state.contextMenuItems.filter((item) => item.pluginId !== pluginId)
	state.modalInstances = state.modalInstances.filter((modal) => modal.pluginId !== pluginId)
	delete state.settingsSchemas[pluginId]
}
