import { type CommandEntry, commandRegistry } from "@cortex/commands"
import type {
	PluginCommandContribution,
	PluginContext,
	PluginDefinition,
	PluginViewContribution,
} from "@cortex.md/api"
import {
	type ContributionSet,
	getContributionKey,
	type RegisteredView,
	registerContributions,
} from "./pluginStore"

export type PluginCommand = PluginCommandContribution<string, PluginContext>
export type PluginView = PluginViewContribution<string, PluginContext>

export interface PluginContributionRuntime {
	runCommand(command: PluginCommand, payload: unknown): Promise<void>
	bindView(
		view: PluginView,
	): Pick<RegisteredView, "render" | "reduce" | "onAction" | "activate" | "remote">
}

export function executePluginCommand(pluginId: string, commandId: string, payload?: unknown) {
	return commandRegistry.execute(`${pluginId}:${commandId}`, { source: "api", payload })
}

/** Registers commands and store contributions; the returned disposer removes the commands. */
export function registerPluginContributions(
	definition: PluginDefinition,
	runtime: PluginContributionRuntime,
): () => void {
	const pluginId = definition.manifest.id
	const contributes = definition.contributes ?? {}
	const commands: CommandEntry[] = (contributes.commands ?? []).map((command) => ({
		id: `${pluginId}:${command.id}`,
		label: command.label,
		category: command.category ?? definition.manifest.name,
		aliases: command.aliases ? [...command.aliases] : undefined,
		icon: command.icon,
		hotkey: command.defaultHotkey
			? { defaultKeys: command.defaultHotkey, scope: "global", enabled: true }
			: undefined,
		execute: (context) => runtime.runCommand(command, context.payload),
	}))
	const hasSettings = Object.keys(definition.settings ?? {}).length > 0
	const contributions: ContributionSet = {
		views: (contributes.views ?? []).map((view) => ({
			id: view.id,
			label: view.label,
			icon: view.icon,
			location: view.location,
			initialState: view.initialState ?? {},
			...runtime.bindView(view),
		})),
		sidebarItems: (contributes.sidebarItems ?? []).map((item) => ({
			id: item.id,
			label: item.label,
			icon: item.icon,
			viewKey: getContributionKey(pluginId, item.view),
		})),
		statusBarItems: (contributes.statusBarItems ?? []).map((item) => ({
			id: item.id,
			position: item.position,
			priority: 0,
			text: item.text,
			icon: item.icon,
			tooltip: item.tooltip,
			when: item.when,
			onClick: item.command
				? () => executePluginCommand(pluginId, item.command as string)
				: undefined,
		})),
		contextMenuItems: (contributes.contextMenuItems ?? []).map((item) => ({
			id: item.id,
			label: item.label,
			icon: item.icon,
			location: item.location,
			action: (context) => executePluginCommand(pluginId, item.command, context),
		})),
		settingsPages: hasSettings
			? [
					{
						id: "settings",
						label: definition.manifest.name,
						title: definition.manifest.name,
						description: "Configure this plugin for the current vault.",
						group: "Plugin settings",
						icon: definition.manifest.icon,
						schema: definition.settings,
					},
				]
			: [],
	}
	registerContributions(pluginId, contributions)
	return commands.length > 0 ? commandRegistry.registerMany(commands) : () => {}
}
