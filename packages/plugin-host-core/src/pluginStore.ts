import type {
	ContextMenuActionContext,
	ContextMenuLocation,
	ModalOpenOptions,
	PluginManifest,
	PluginSettingsSchema,
	PluginViewLocation,
	PluginViewState,
	ViewDescriptor,
} from "@cortex.md/api"
import { create } from "zustand"
import type { RemoteViewRuntime } from "./bridge/remoteView"

export const CORE_OWNER = "core"

export type PluginStatus = "loaded" | "enabled" | "disabled" | "error"

export interface PluginRecord {
	manifest: PluginManifest
	status: PluginStatus
	error?: string
	community: boolean
}

export type ContributionIcon = string | object

interface ContributionIdentity {
	owner: string
	key: string
	id: string
}

export interface RegisteredView extends ContributionIdentity {
	label: string
	icon: ContributionIcon
	location: PluginViewLocation
	initialState: PluginViewState
	component?: unknown
	render?: (state: PluginViewState) => ViewDescriptor
	reduce?: (state: PluginViewState, action: string, payload: unknown) => PluginViewState
	onAction?: (action: string, payload: unknown, state: PluginViewState) => void
	activate?: () => Promise<void>
	remote?: RemoteViewRuntime
}

export interface RegisteredSidebarItem extends ContributionIdentity {
	label: string
	icon: ContributionIcon
	viewKey: string
}

export interface RegisteredStatusBarItem extends ContributionIdentity {
	position: "left" | "right"
	priority: number
	text?: string
	icon?: string
	tooltip?: string
	when?: string
	component?: unknown
	onClick?: () => void
}

export interface RegisteredSettingsPage extends ContributionIdentity {
	label: string
	title: string
	description: string
	group: string
	icon: ContributionIcon
	schema?: PluginSettingsSchema
	component?: unknown
}

export interface RegisteredContextMenuItem extends ContributionIdentity {
	label: string
	icon?: string
	location: ContextMenuLocation
	action: (context: ContextMenuActionContext) => void
}

export interface PluginModalInstance {
	id: string
	owner: string
	viewKey: string
	title?: string
	state: PluginViewState
}

type ContributionInput<T> = Omit<T, "owner" | "key">

export interface ContributionSet {
	views?: ContributionInput<RegisteredView>[]
	sidebarItems?: ContributionInput<RegisteredSidebarItem>[]
	statusBarItems?: ContributionInput<RegisteredStatusBarItem>[]
	settingsPages?: ContributionInput<RegisteredSettingsPage>[]
	contextMenuItems?: ContributionInput<RegisteredContextMenuItem>[]
}

type ContributionKind = keyof ContributionSet

export interface PluginStoreState {
	plugins: Record<string, PluginRecord>
	loadErrors: Record<string, string>
	views: RegisteredView[]
	sidebarItems: RegisteredSidebarItem[]
	statusBarItems: RegisteredStatusBarItem[]
	settingsPages: RegisteredSettingsPage[]
	contextMenuItems: RegisteredContextMenuItem[]
	modalInstances: PluginModalInstance[]
	settingsValues: Record<string, Record<string, unknown>>
}

const contributionKinds: ContributionKind[] = [
	"views",
	"sidebarItems",
	"statusBarItems",
	"settingsPages",
	"contextMenuItems",
]

function createInitialState(): PluginStoreState {
	return {
		plugins: {},
		loadErrors: {},
		views: [],
		sidebarItems: [],
		statusBarItems: [],
		settingsPages: [],
		contextMenuItems: [],
		modalInstances: [],
		settingsValues: {},
	}
}

export const usePluginStore = create<PluginStoreState>()(createInitialState)

let nextModalInstanceId = 0

export function getContributionKey(owner: string, id: string): string {
	return owner === CORE_OWNER ? id : `${owner}:${id}`
}

function withoutOwner<T extends { owner: string }>(items: T[], owner: string): T[] {
	return items.some((item) => item.owner === owner)
		? items.filter((item) => item.owner !== owner)
		: items
}

export function registerContributions(owner: string, contributions: ContributionSet): () => void {
	const state = usePluginStore.getState()
	const next: Partial<PluginStoreState> = {}
	for (const kind of contributionKinds) {
		const items = contributions[kind]
		if (!items?.length) continue
		const owned = items.map((item) => ({
			...item,
			owner,
			key: getContributionKey(owner, item.id),
		}))
		const keys = new Set(owned.map((item) => item.key))
		const current = state[kind] as ContributionIdentity[]
		next[kind] = [...current.filter((item) => !keys.has(item.key)), ...owned] as never
	}
	usePluginStore.setState(next)
	return () => clearOwnerContributions(owner)
}

export function clearOwnerContributions(owner: string): void {
	const state = usePluginStore.getState()
	const { [owner]: _removed, ...settingsValues } = state.settingsValues
	usePluginStore.setState({
		views: withoutOwner(state.views, owner),
		sidebarItems: withoutOwner(state.sidebarItems, owner),
		statusBarItems: withoutOwner(state.statusBarItems, owner),
		settingsPages: withoutOwner(state.settingsPages, owner),
		contextMenuItems: withoutOwner(state.contextMenuItems, owner),
		modalInstances: withoutOwner(state.modalInstances, owner),
		settingsValues: owner in state.settingsValues ? settingsValues : state.settingsValues,
	})
}

export function updateView(key: string, patch: Partial<RegisteredView>): void {
	usePluginStore.setState((state) => ({
		views: state.views.map((view) => (view.key === key ? { ...view, ...patch } : view)),
	}))
}

export function setPluginRecord(pluginId: string, record: PluginRecord | null): void {
	usePluginStore.setState((state) => {
		const { [pluginId]: _removed, ...plugins } = state.plugins
		return { plugins: record ? { ...plugins, [pluginId]: record } : plugins }
	})
}

export function setPluginLoadError(pluginId: string, error: string | null): void {
	usePluginStore.setState((state) => {
		if (!error && !(pluginId in state.loadErrors)) return state
		const { [pluginId]: _removed, ...loadErrors } = state.loadErrors
		return { loadErrors: error ? { ...loadErrors, [pluginId]: error } : loadErrors }
	})
}

export function setPluginStatus(pluginId: string, status: PluginStatus, error?: string): void {
	const record = usePluginStore.getState().plugins[pluginId]
	if (record) setPluginRecord(pluginId, { ...record, status, error })
}

export function setOwnerSettingsValues(
	owner: string,
	values: Record<string, unknown> | null,
): void {
	usePluginStore.setState((state) => {
		const { [owner]: _removed, ...settingsValues } = state.settingsValues
		return { settingsValues: values ? { ...settingsValues, [owner]: values } : settingsValues }
	})
}

export function openModal(
	owner: string,
	viewKey: string,
	options?: ModalOpenOptions & { instanceId?: unknown },
): string | null {
	const { views, modalInstances } = usePluginStore.getState()
	const view = views.find(
		(candidate) => candidate.key === viewKey && candidate.location === "modal",
	)
	if (!view || view.owner !== owner) return null
	const id = options?.instanceId ?? `${owner}:modal-${nextModalInstanceId++}`
	if (
		typeof id !== "string" ||
		!id.startsWith(`${owner}:`) ||
		modalInstances.some((modal) => modal.id === id)
	) {
		return null
	}
	const instance: PluginModalInstance = {
		id,
		owner,
		viewKey,
		title: options?.title,
		state: options?.initialState ?? view.initialState,
	}
	usePluginStore.setState((state) => ({ modalInstances: [...state.modalInstances, instance] }))
	return instance.id
}

export function closeModal(instanceId: string, owner?: string): void {
	usePluginStore.setState((state) => ({
		modalInstances: state.modalInstances.filter(
			(modal) => modal.id !== instanceId || (owner !== undefined && modal.owner !== owner),
		),
	}))
}

export function updateModalState(instanceId: string, modalState: PluginViewState): void {
	usePluginStore.setState((state) => ({
		modalInstances: state.modalInstances.map((modal) =>
			modal.id === instanceId ? { ...modal, state: modalState } : modal,
		),
	}))
}

export function resetPluginStore(): void {
	nextModalInstanceId = 0
	usePluginStore.setState(createInitialState(), true)
}
