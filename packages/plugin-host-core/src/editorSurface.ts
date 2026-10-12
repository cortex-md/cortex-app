import {
	registerCalloutType,
	registerMarkdownInline,
	registerMarkdownSemantic,
} from "@cortex/renderer"
import type { Disposable, PluginDefinition, PluginFoldProviderRegistration } from "@cortex.md/api"
import { reportPluginOperationError } from "./communityPlugins"
import { type EditorViewLike, getOpenEditorViews, onEditorViewAdded } from "./editorViews"
import type {
	EditorContributionSnapshot,
	PluginHostServices,
	RegisteredEditorFoldProvider,
} from "./pluginContext"

type EditorRuntime = NonNullable<PluginHostServices["editorRuntime"]>
type MarkdownContributions = NonNullable<NonNullable<PluginDefinition["contributes"]>["markdown"]>

export interface PluginSettingsAccess {
	get(key: string): unknown
	onChange(key: string, listener: (value: unknown) => void): Disposable
}

function toDisposable(dispose: () => void): Disposable {
	return { dispose }
}

export function createEditorContributions(editorRuntime: EditorRuntime) {
	const extensions = new Map<string, unknown>()
	const foldProviders = new Map<string, RegisteredEditorFoldProvider>()
	const viewGenerations = new WeakMap<EditorViewLike, number>()

	function getSnapshot(): EditorContributionSnapshot {
		return {
			extensions: Array.from(extensions.values()),
			foldProviders: Array.from(foldProviders.values()).sort(
				(first, second) =>
					(second.priority ?? 0) - (first.priority ?? 0) ||
					first.registrationKey.localeCompare(second.registrationKey),
			),
		}
	}

	function apply(views: EditorViewLike[] = getOpenEditorViews()): void {
		const snapshot = getSnapshot()
		for (const view of views) {
			const generation = (viewGenerations.get(view) ?? 0) + 1
			viewGenerations.set(view, generation)
			const isCurrent = () => viewGenerations.get(view) === generation
			void Promise.resolve(editorRuntime.reconfigure(view, snapshot, isCurrent)).catch((error) =>
				reportPluginOperationError("reconfigure-editor", "editor", error),
			)
		}
	}

	const stopViewListener = onEditorViewAdded((view) => {
		if (extensions.size > 0 || foldProviders.size > 0) apply([view])
	})

	return {
		apply,
		setExtensions(pluginId: string, value: unknown): void {
			extensions.set(pluginId, value)
		},
		addFoldProviders(
			pluginId: string,
			providers: readonly PluginFoldProviderRegistration[],
		): Disposable[] {
			return providers.map((provider) => {
				const registrationKey = `${pluginId}:${provider.id}`
				foldProviders.set(registrationKey, { ...provider, pluginId, registrationKey })
				return toDisposable(() => foldProviders.delete(registrationKey))
			})
		},
		removePlugin(pluginId: string): boolean {
			return (
				extensions.delete(pluginId) ||
				Array.from(foldProviders.values()).some((provider) => provider.pluginId === pluginId)
			)
		},
		dispose: stopViewListener,
	}
}

export function registerMarkdownContributions(
	pluginId: string,
	markdown: Pick<MarkdownContributions, "inline" | "semantic" | "callouts">,
	settings: PluginSettingsAccess,
): Disposable[] {
	const disposables: Disposable[] = []
	for (const rule of markdown.inline ?? []) {
		const register = () => registerMarkdownInline(rule, pluginId)
		if (!rule.when) {
			disposables.push(toDisposable(register()))
			continue
		}
		const settingKey = rule.when
		let unregister: (() => void) | null = settings.get(settingKey) === true ? register() : null
		disposables.push(
			settings.onChange(settingKey, (value) => {
				unregister?.()
				unregister = value === true ? register() : null
			}),
			toDisposable(() => unregister?.()),
		)
	}
	for (const rule of markdown.semantic ?? []) {
		disposables.push(toDisposable(registerMarkdownSemantic(rule, pluginId)))
	}
	for (const callout of markdown.callouts ?? []) {
		disposables.push(toDisposable(registerCalloutType(callout, pluginId)))
	}
	return disposables
}
