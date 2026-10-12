import type {
	PluginActivationResult,
	PluginCommandContribution,
	PluginCommandHandler,
	PluginContext,
	PluginDefinition,
	PluginImplementation,
	PluginViewHandlers,
} from "@cortex.md/api"
import { reportPluginOperationError } from "./communityPlugins"
import type { RegisteredView } from "./pluginStore"

export async function activatePluginDefinition(
	definition: PluginDefinition,
	context: PluginContext,
	hooks: {
		onLoad(implementation: PluginImplementation): void
		track(result: PluginActivationResult): void
	},
): Promise<void> {
	let implementation: PluginImplementation | null = null
	if (definition.load) {
		const loaded = await definition.load()
		implementation = "default" in loaded ? loaded.default : loaded
		hooks.onLoad(implementation)
	}
	hooks.track(await definition.activate?.(context))
	hooks.track(await implementation?.activate?.(context))
}

export function getCommandHandler(
	pluginId: string,
	command: PluginCommandContribution<string, PluginContext>,
	implementation: PluginImplementation | null,
): PluginCommandHandler<PluginContext> {
	const handler = command.run ?? implementation?.commands?.[command.id]
	if (!handler) throw new Error(`Plugin "${pluginId}" has no handler for "${command.id}"`)
	return handler
}

export function bindPluginView(
	pluginId: string,
	handlers: Partial<PluginViewHandlers<PluginContext>>,
	context: PluginContext,
): Pick<RegisteredView, "render" | "reduce" | "onAction"> {
	return {
		render: handlers.render ? (state) => handlers.render?.(state, context) ?? [] : undefined,
		reduce: handlers.reduce
			? (state, action, payload) => handlers.reduce?.(state, action, payload) ?? state
			: undefined,
		onAction: handlers.onAction
			? (action, payload, state) => {
					void Promise.resolve(handlers.onAction?.(context, action, payload, state)).catch(
						(error) => reportPluginOperationError(`view:${action}`, pluginId, error),
					)
				}
			: undefined,
	}
}
