import type { PluginViewState } from "@cortex.md/api"
import { reportPluginOperationError } from "../communityPlugins"
import type { RegisteredView } from "../pluginStore"
import type {
	ControlledPluginViewState,
	PluginViewController,
	PluginViewSnapshot,
} from "../pluginViewController"
import type {
	JsonValue,
	PluginInvokeRequest,
	PluginViewUpdateMessage,
	RemoteViewSnapshot,
} from "./protocol"

export interface RemoteViewRuntime {
	invoke(pluginId: string, request: PluginInvokeRequest): Promise<void>
	onViewUpdate(listener: (update: PluginViewUpdateMessage) => void): () => void
}

let nextRemoteInstance = 0

function toError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause))
}

function fromRemoteSnapshot(view: RemoteViewSnapshot): PluginViewSnapshot {
	return view.status === "error" ? { status: "error", error: new Error(view.error) } : view
}

export function toRemoteSnapshot(view: PluginViewSnapshot): RemoteViewSnapshot {
	return view.status === "error" ? { status: "error", error: view.error.message } : view
}

export function createRemoteViewController(
	registration: RegisteredView,
	runtime: RemoteViewRuntime,
	initialState: PluginViewState,
): PluginViewController {
	const { owner: pluginId, id: viewId } = registration
	const instanceKey = `${registration.key}#${++nextRemoteInstance}`
	const listeners = new Set<() => void>()
	let state = initialState
	let snapshot: PluginViewSnapshot = { status: "loading" }
	let controlledState: ControlledPluginViewState | undefined

	function report(operation: string) {
		return (error: unknown) => reportPluginOperationError(operation, pluginId, error)
	}

	function publish(nextState: PluginViewState, nextSnapshot: PluginViewSnapshot) {
		if (nextState !== state) controlledState?.onStateChange?.(nextState)
		state = nextState
		snapshot = nextSnapshot
		for (const listener of listeners) listener()
	}

	return {
		activate() {
			const stopUpdates = runtime.onViewUpdate((update) => {
				if (update.pluginId !== pluginId || update.instanceKey !== instanceKey) return
				publish(update.state, fromRemoteSnapshot(update.view))
			})
			Promise.resolve(registration.activate?.())
				.then(() =>
					runtime.invoke(pluginId, {
						kind: "viewOpen",
						viewId,
						instanceKey,
						initialState: state,
					}),
				)
				.catch((cause: unknown) => {
					report("activate")(cause)
					publish(state, { status: "error", error: toError(cause) })
				})
			return () => {
				stopUpdates()
				runtime.invoke(pluginId, { kind: "viewClose", instanceKey }).catch(report("view:close"))
			}
		},
		subscribe(listener) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		getState: () => state,
		render(controlled) {
			controlledState = controlled
			return snapshot
		},
		dispatch(action, payload, controlled) {
			if (controlled) controlledState = controlled
			runtime
				.invoke(pluginId, {
					kind: "viewAction",
					instanceKey,
					action,
					payload: (payload ?? null) as JsonValue,
				})
				.catch(report(`view:${action}`))
		},
	}
}
