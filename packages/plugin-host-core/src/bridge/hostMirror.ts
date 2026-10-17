import { getErrorMessage } from "../communityPlugins"
import { executePluginCommand } from "../pluginContributions"
import type { PluginHost } from "../pluginHost"
import {
	CORE_OWNER,
	closeModal,
	getContributionKey,
	type PluginStoreState,
	updateModalState,
	usePluginStore,
} from "../pluginStore"
import { createPluginViewController, type PluginViewController } from "../pluginViewController"
import {
	type PluginControlRequest,
	type PluginHostMessage,
	type PluginInvokeRequest,
	type PluginUiMessage,
	serializePluginDefinition,
} from "./protocol"
import { toRemoteSnapshot } from "./remoteView"

export interface PluginHostMirror {
	receive(message: PluginUiMessage): void
	dispose(): void
}

type MirroredState = Pick<
	PluginStoreState,
	"plugins" | "loadErrors" | "loadedVaultPath" | "settingsValues" | "modalInstances"
>

interface HostView {
	controller: PluginViewController | null
	stop(): void
}

export function createPluginHostMirror(
	host: PluginHost,
	send: (message: PluginHostMessage) => void,
): PluginHostMirror {
	const registered = new Set<string>()
	const views = new Map<string, HostView>()
	let previous: MirroredState = {
		plugins: {},
		loadErrors: {},
		loadedVaultPath: null,
		settingsValues: {},
		modalInstances: [],
	}

	function syncRegistrations(plugins: PluginStoreState["plugins"]): void {
		for (const pluginId of registered) {
			if (plugins[pluginId]?.status === "enabled") continue
			registered.delete(pluginId)
			send({ type: "unregister", pluginId })
		}
		for (const [pluginId, record] of Object.entries(plugins)) {
			if (record.status !== "enabled" || registered.has(pluginId)) continue
			const definition = host.getPluginDefinition(pluginId)
			if (!definition) continue
			registered.add(pluginId)
			send({ type: "register", definition: serializePluginDefinition(definition) })
		}
	}

	function sync(state: PluginStoreState): void {
		if (
			state.plugins !== previous.plugins ||
			state.loadErrors !== previous.loadErrors ||
			state.loadedVaultPath !== previous.loadedVaultPath
		) {
			send({
				type: "records",
				plugins: state.plugins,
				loadErrors: state.loadErrors,
				loadedVaultPath: state.loadedVaultPath,
			})
			syncRegistrations(state.plugins)
		}
		if (state.settingsValues !== previous.settingsValues) {
			const owners = new Set([
				...Object.keys(previous.settingsValues),
				...Object.keys(state.settingsValues),
			])
			for (const pluginId of owners) {
				const values = state.settingsValues[pluginId]
				if (pluginId === CORE_OWNER || values === previous.settingsValues[pluginId]) continue
				send({ type: "settings", pluginId, values: values ?? null })
			}
		}
		if (state.modalInstances !== previous.modalInstances) {
			const instances = state.modalInstances.filter((modal) => modal.owner !== CORE_OWNER)
			send({ type: "modals", instances })
		}
		previous = state
	}

	function closeView(instanceKey: string): void {
		views.get(instanceKey)?.stop()
		views.delete(instanceKey)
	}

	async function openView(
		pluginId: string,
		{ viewId, instanceKey, initialState }: Extract<PluginInvokeRequest, { kind: "viewOpen" }>,
	): Promise<void> {
		closeView(instanceKey)
		const key = getContributionKey(pluginId, viewId)
		const findView = () =>
			usePluginStore.getState().views.find((view) => view.key === key && view.owner === pluginId)
		const pending = findView()
		if (!pending) throw new Error(`Plugin "${pluginId}" has no view "${viewId}"`)
		const entry: HostView = { controller: null, stop: () => {} }
		views.set(instanceKey, entry)
		await pending.activate?.()
		if (views.get(instanceKey) !== entry) return
		const controller = createPluginViewController(findView() ?? pending, initialState)
		const push = () =>
			send({
				type: "viewUpdate",
				pluginId,
				instanceKey,
				state: controller.getState(),
				view: toRemoteSnapshot(controller.render()),
			})
		entry.controller = controller
		entry.stop = controller.subscribe(push)
		push()
	}

	async function invoke(pluginId: string, request: PluginInvokeRequest): Promise<void> {
		switch (request.kind) {
			case "command": {
				if (!executePluginCommand(pluginId, request.id, request.payload)) {
					throw new Error(`Plugin "${pluginId}" has no command "${request.id}"`)
				}
				return
			}
			case "viewOpen":
				return openView(pluginId, request)
			case "viewAction": {
				const controller = views.get(request.instanceKey)?.controller
				if (!controller) throw new Error(`View "${request.instanceKey}" is not open`)
				controller.dispatch(request.action, request.payload)
				return
			}
			case "viewClose":
				closeView(request.instanceKey)
		}
	}

	async function control(request: PluginControlRequest): Promise<void> {
		switch (request.action) {
			case "enable":
				return host.enablePlugin(request.pluginId)
			case "disable":
				return host.disablePlugin(request.pluginId)
			case "unregister":
				return host.unregisterCommunityPlugin(request.pluginId)
			case "setSetting":
				return host.setPluginSetting(request.pluginId, request.key, request.value)
			case "discover":
				return host.discoverCommunityPlugins(request.pluginsDir)
			case "reload":
				return host.reloadCommunityPlugins(request.pluginsDir)
			case "saveEnabled":
				return host.saveEnabledPlugins()
			case "closeModal":
				return closeModal(request.instanceId)
			case "updateModalState":
				return updateModalState(request.instanceId, request.state)
		}
	}

	sync(usePluginStore.getState())
	const unsubscribe = usePluginStore.subscribe(sync)

	return {
		receive(message) {
			const run =
				message.type === "invoke"
					? invoke(message.pluginId, message.request)
					: control(message.request)
			run.then(
				() => send({ type: "result", id: message.id }),
				(error: unknown) => send({ type: "result", id: message.id, error: getErrorMessage(error) }),
			)
		},
		dispose() {
			unsubscribe()
			for (const instanceKey of Array.from(views.keys())) closeView(instanceKey)
			registered.clear()
		},
	}
}
