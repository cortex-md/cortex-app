import type { PluginViewState, ViewDescriptor } from "@cortex.md/api"
import { createRemoteViewController } from "./bridge/remoteView"
import { reportPluginOperationError } from "./communityPlugins"
import type { RegisteredView } from "./pluginStore"

export type PluginViewSnapshot =
	| { status: "loading" | "empty" }
	| { status: "ready"; descriptor: ViewDescriptor }
	| { status: "error"; error: Error }

export interface ControlledPluginViewState {
	state: PluginViewState
	onStateChange?: (state: PluginViewState) => void
}

export interface PluginViewController {
	activate(): () => void
	subscribe(listener: () => void): () => void
	getState(): PluginViewState
	render(controlled?: ControlledPluginViewState): PluginViewSnapshot
	dispatch(action: string, payload?: unknown, controlled?: ControlledPluginViewState): void
}

function toError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause))
}

export function createPluginViewController(
	registration: RegisteredView,
	initialState: PluginViewState = registration.initialState,
): PluginViewController {
	if (registration.remote) {
		return createRemoteViewController(registration, registration.remote, initialState)
	}
	const listeners = new Set<() => void>()
	let state = initialState
	let renderError: Error | null = null

	return {
		activate() {
			registration
				.activate?.()
				.catch((error: unknown) =>
					reportPluginOperationError("activate", registration.owner, error),
				)
			return () => {}
		},
		subscribe(listener) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		getState: () => state,
		render(controlled) {
			if (renderError) return { status: "error", error: renderError }
			if (!registration.render) return { status: registration.activate ? "loading" : "empty" }
			try {
				return { status: "ready", descriptor: registration.render(controlled?.state ?? state) }
			} catch (cause) {
				renderError = toError(cause)
				reportPluginOperationError(`render:${registration.key}`, registration.owner, renderError)
				return { status: "error", error: renderError }
			}
		},
		dispatch(action, payload, controlled) {
			try {
				const current = controlled ? controlled.state : state
				const next = registration.reduce ? registration.reduce(current, action, payload) : current
				if (controlled) {
					controlled.onStateChange?.(next)
				} else if (next !== state) {
					state = next
					for (const listener of listeners) listener()
				}
				registration.onAction?.(action, payload, next)
			} catch (error) {
				reportPluginOperationError(`view:${action}`, registration.owner, error)
			}
		},
	}
}
