import type { PluginViewState } from "@cortex.md/api"
import { getCommunityPluginsDir, reportPluginOperationError } from "../communityPlugins"
import { registerPluginContributions } from "../pluginContributions"
import type { PluginHost } from "../pluginHost"
import {
	CORE_OWNER,
	clearOwnerContributions,
	setOwnerSettingsValues,
	usePluginStore,
} from "../pluginStore"
import type {
	JsonValue,
	PluginControlRequest,
	PluginHostMessage,
	PluginUiMessage,
	PluginViewUpdateMessage,
	SerializedPluginDefinition,
} from "./protocol"
import type { RemoteViewRuntime } from "./remoteView"

export type PluginHostFacade = Pick<
	PluginHost,
	| "enablePlugin"
	| "disablePlugin"
	| "saveEnabledPlugins"
	| "setPluginSetting"
	| "discoverCommunityPlugins"
	| "reloadCommunityPlugins"
	| "unregisterCommunityPlugin"
	| "isPluginInstalled"
	| "getCommunityPluginLoadError"
	| "getCommunityPluginsDir"
> & {
	closeModal(instanceId: string): void
	updateModalState(instanceId: string, state: PluginViewState): void
}

export interface PluginUiMirror {
	receive(message: PluginHostMessage): void
	facade: PluginHostFacade
	/** Clears everything mirrored and rejects pending requests; the mirror stays usable. */
	dispose(): void
}

export function createPluginUiMirror(options: {
	send(message: PluginUiMessage): void
	getVaultPath(): string | null
}): PluginUiMirror {
	const pending = new Map<number, { resolve(): void; reject(error: Error): void }>()
	const viewListeners = new Set<(update: PluginViewUpdateMessage) => void>()
	const registrations = new Map<string, () => void>()
	let nextRequestId = 0

	function request(build: (id: number) => PluginUiMessage): Promise<void> {
		const id = ++nextRequestId
		return new Promise((resolve, reject) => {
			pending.set(id, { resolve, reject })
			options.send(build(id))
		})
	}

	const control = (controlRequest: PluginControlRequest) =>
		request((id) => ({ type: "control", id, request: controlRequest }))

	function fire(controlRequest: PluginControlRequest, pluginId: string): void {
		control(controlRequest).catch((error) =>
			reportPluginOperationError(controlRequest.action, pluginId, error),
		)
	}

	const runtime: RemoteViewRuntime = {
		invoke: (pluginId, invokeRequest) =>
			request((id) => ({ type: "invoke", id, pluginId, request: invokeRequest })),
		onViewUpdate(listener) {
			viewListeners.add(listener)
			return () => {
				viewListeners.delete(listener)
			}
		},
	}

	function unregister(pluginId: string): void {
		registrations.get(pluginId)?.()
		registrations.delete(pluginId)
	}

	function register(definition: SerializedPluginDefinition): void {
		const pluginId = definition.manifest.id
		unregister(pluginId)
		const stopCommands = registerPluginContributions(definition, {
			runCommand: (command, payload) =>
				runtime.invoke(pluginId, {
					kind: "command",
					id: command.id,
					payload: (payload ?? null) as JsonValue,
				}),
			bindView: () => ({ remote: runtime }),
		})
		registrations.set(pluginId, () => {
			stopCommands()
			clearOwnerContributions(pluginId)
		})
	}

	function receive(message: PluginHostMessage): void {
		switch (message.type) {
			case "register":
				register(message.definition)
				return
			case "unregister":
				unregister(message.pluginId)
				return
			case "records":
				usePluginStore.setState({
					plugins: message.plugins,
					loadErrors: message.loadErrors,
					loadedVaultPath: message.loadedVaultPath,
				})
				return
			case "settings":
				setOwnerSettingsValues(message.pluginId, message.values)
				return
			case "modals":
				usePluginStore.setState((state) => ({
					modalInstances: [
						...state.modalInstances.filter((modal) => modal.owner === CORE_OWNER),
						...message.instances,
					],
				}))
				return
			case "viewUpdate":
				for (const listener of viewListeners) listener(message)
				return
			case "result": {
				const request = pending.get(message.id)
				pending.delete(message.id)
				if (message.error === undefined) request?.resolve()
				else request?.reject(new Error(message.error))
			}
		}
	}

	return {
		receive,
		facade: {
			enablePlugin: (pluginId) => control({ action: "enable", pluginId }),
			disablePlugin: (pluginId) => control({ action: "disable", pluginId }),
			saveEnabledPlugins: () => control({ action: "saveEnabled" }),
			setPluginSetting: (pluginId, key, value) =>
				control({ action: "setSetting", pluginId, key, value: value as JsonValue }),
			discoverCommunityPlugins: (pluginsDir) => control({ action: "discover", pluginsDir }),
			reloadCommunityPlugins: (pluginsDir) => control({ action: "reload", pluginsDir }),
			unregisterCommunityPlugin: (pluginId) => fire({ action: "unregister", pluginId }, pluginId),
			isPluginInstalled: (pluginId) => Object.hasOwn(usePluginStore.getState().plugins, pluginId),
			getCommunityPluginLoadError: (pluginId) =>
				usePluginStore.getState().loadErrors[pluginId] ?? null,
			getCommunityPluginsDir: () => getCommunityPluginsDir(options.getVaultPath()),
			closeModal: (instanceId) => fire({ action: "closeModal", instanceId }, "modal"),
			updateModalState: (instanceId, state) =>
				fire({ action: "updateModalState", instanceId, state }, "modal"),
		},
		dispose() {
			for (const pluginId of Array.from(registrations.keys())) unregister(pluginId)
			for (const request of pending.values()) request.reject(new Error("Plugin host disconnected"))
			pending.clear()
			usePluginStore.setState((state) => ({
				plugins: {},
				loadErrors: {},
				settingsValues: Object.fromEntries(
					Object.entries(state.settingsValues).filter(([owner]) => owner === CORE_OWNER),
				),
				modalInstances: state.modalInstances.filter((modal) => modal.owner === CORE_OWNER),
			}))
		},
	}
}
