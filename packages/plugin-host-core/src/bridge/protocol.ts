import type {
	PluginCommandContribution,
	PluginContextMenuItemContribution,
	PluginDefinition,
	PluginManifest,
	PluginSettingsSchema,
	PluginSidebarItemContribution,
	PluginStatusBarItemContribution,
	PluginViewContribution,
	PluginViewState,
	ViewDescriptor,
} from "@cortex.md/api"
import type { PluginModalInstance, PluginRecord } from "../pluginStore"

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue }

/** A `PluginDefinition` without functions: what the UI realm needs to render contributions. */
export type SerializedPluginDefinition = {
	manifest: PluginManifest
	settings?: PluginSettingsSchema
	contributes: {
		commands: Omit<PluginCommandContribution<string, unknown>, "run">[]
		views: Pick<
			PluginViewContribution<string, unknown>,
			"id" | "label" | "icon" | "location" | "initialState"
		>[]
		sidebarItems: PluginSidebarItemContribution<string>[]
		statusBarItems: PluginStatusBarItemContribution<string, string>[]
		contextMenuItems: PluginContextMenuItemContribution<string>[]
	}
}

export type RemoteViewSnapshot =
	| { status: "loading" | "empty" }
	| { status: "ready"; descriptor: ViewDescriptor }
	| { status: "error"; error: string }

export type PluginInvokeRequest =
	| { kind: "command"; id: string; payload: JsonValue }
	| { kind: "viewOpen"; viewId: string; instanceKey: string; initialState: PluginViewState }
	| { kind: "viewAction"; instanceKey: string; action: string; payload: JsonValue }
	| { kind: "viewClose"; instanceKey: string }

export type PluginControlRequest =
	| { action: "enable" | "disable" | "unregister"; pluginId: string }
	| { action: "setSetting"; pluginId: string; key: string; value: JsonValue }
	| { action: "discover" | "reload"; pluginsDir: string }
	| { action: "saveEnabled" }
	| { action: "closeModal"; instanceId: string }
	| { action: "updateModalState"; instanceId: string; state: PluginViewState }

export type PluginViewUpdateMessage = {
	type: "viewUpdate"
	pluginId: string
	instanceKey: string
	state: PluginViewState
	view: RemoteViewSnapshot
}

/** Host realm (runs plugins) → UI realm (renders them). JSON only; slices are sent when they change. */
export type PluginHostMessage =
	| { type: "register"; definition: SerializedPluginDefinition }
	| { type: "unregister"; pluginId: string }
	| { type: "records"; plugins: Record<string, PluginRecord>; loadErrors: Record<string, string> }
	| { type: "settings"; pluginId: string; values: Record<string, unknown> | null }
	| { type: "modals"; instances: PluginModalInstance[] }
	| PluginViewUpdateMessage
	| { type: "result"; id: number; error?: string }

/** UI realm → host realm. Every message is answered by one `result` with the same `id`. */
export type PluginUiMessage =
	| { type: "invoke"; id: number; pluginId: string; request: PluginInvokeRequest }
	| { type: "control"; id: number; request: PluginControlRequest }

export function serializePluginDefinition(
	definition: PluginDefinition,
): SerializedPluginDefinition {
	const contributes = definition.contributes ?? {}
	return {
		manifest: definition.manifest,
		settings: definition.settings,
		contributes: {
			commands: (contributes.commands ?? []).map(
				({ id, label, category, aliases, icon, defaultHotkey }) => ({
					id,
					label,
					category,
					aliases,
					icon,
					defaultHotkey,
				}),
			),
			views: (contributes.views ?? []).map(({ id, label, icon, location, initialState }) => ({
				id,
				label,
				icon,
				location,
				initialState,
			})),
			sidebarItems: [...(contributes.sidebarItems ?? [])],
			statusBarItems: [...(contributes.statusBarItems ?? [])],
			contextMenuItems: [...(contributes.contextMenuItems ?? [])],
		},
	}
}
