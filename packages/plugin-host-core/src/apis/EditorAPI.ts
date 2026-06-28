import type { Disposable, PluginAPI, PluginFoldProviderRegistration } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

type EditorViewLike = {
	dispatch: (spec: { changes?: unknown }) => void
	state: { doc: { toString: () => string }; selection: { main: { from: number; to: number } } }
}

export interface RegisteredEditorFoldProvider extends PluginFoldProviderRegistration {
	pluginId: string
	registrationKey: string
}

export interface EditorContributionSnapshot {
	extensions: unknown[]
	foldProviders: RegisteredEditorFoldProvider[]
}

type ReconfigureFn = (
	view: EditorViewLike,
	contributions: EditorContributionSnapshot,
	isCurrent?: () => boolean,
) => void | Promise<void>

let editorViewRef: EditorViewLike | null = null
let reconfigureFn: ReconfigureFn | null = null
let getActiveFilePathFn: (() => string | null) | null = null
let getActiveFileContentFn: (() => string | null) | null = null
const registeredExtensions = new Map<string, unknown>()
const registeredFoldProviders = new Map<string, RegisteredEditorFoldProvider>()
let nextExtensionId = 0
let nextFoldProviderId = 0
let extensionApplyGeneration = 0

export function setEditorViewRef(view: EditorViewLike | null): void {
	editorViewRef = view
	applyExtensions()
}

export function getEditorViewRef(): EditorViewLike | null {
	return editorViewRef
}

export function setReconfigurePluginExtensions(fn: ReconfigureFn): void {
	reconfigureFn = fn
}

export function setEditorContextFunctions(fns: {
	getActiveFilePath: () => string | null
	getActiveFileContent: () => string | null
}): void {
	getActiveFilePathFn = fns.getActiveFilePath
	getActiveFileContentFn = fns.getActiveFileContent
}

function applyExtensions(): void {
	if (!editorViewRef || !reconfigureFn) return
	const generation = ++extensionApplyGeneration
	const view = editorViewRef
	const contributions: EditorContributionSnapshot = {
		extensions: Array.from(registeredExtensions.values()),
		foldProviders: Array.from(registeredFoldProviders.values()).sort(compareFoldProviders),
	}
	const isCurrent = () => generation === extensionApplyGeneration && view === editorViewRef
	void Promise.resolve(reconfigureFn(view, contributions, isCurrent)).catch(() => {})
}

function compareFoldProviders(
	first: RegisteredEditorFoldProvider,
	second: RegisteredEditorFoldProvider,
): number {
	const priorityDifference = (second.priority ?? 0) - (first.priority ?? 0)
	if (priorityDifference !== 0) return priorityDifference
	return first.registrationKey.localeCompare(second.registrationKey)
}

function createRegisteredFoldProvider(
	pluginId: string,
	registrationKey: string,
	provider: PluginFoldProviderRegistration,
): RegisteredEditorFoldProvider {
	if (!provider.id.trim()) throw new Error("Fold provider id is required")
	if (typeof provider.getFoldRange !== "function") {
		throw new Error("Fold provider getFoldRange must be a function")
	}
	return {
		...provider,
		pluginId,
		registrationKey,
	}
}

export function createEditorAPI(pluginId: string): PluginAPI["editor"] {
	return {
		registerExtension(extension: unknown): Disposable {
			requirePluginCapability(pluginId, "editor:extensions")
			const id = `ext-${nextExtensionId++}`
			registeredExtensions.set(id, extension)
			applyExtensions()
			return {
				dispose() {
					registeredExtensions.delete(id)
					applyExtensions()
				},
			}
		},

		registerFoldProvider(provider: PluginFoldProviderRegistration): Disposable {
			requirePluginCapability(pluginId, "editor:folding")
			const id = `fold-${nextFoldProviderId++}`
			const registrationKey = `${pluginId}:${provider.id}:${id}`
			registeredFoldProviders.set(
				id,
				createRegisteredFoldProvider(pluginId, registrationKey, provider),
			)
			applyExtensions()
			return {
				dispose() {
					registeredFoldProviders.delete(id)
					applyExtensions()
				},
			}
		},

		getActiveFilePath() {
			requirePluginCapability(pluginId, "editor:read")
			return getActiveFilePathFn?.() ?? null
		},

		getActiveFileContent() {
			requirePluginCapability(pluginId, "editor:read")
			return getActiveFileContentFn?.() ?? editorViewRef?.state.doc.toString() ?? null
		},

		insertAtCursor(text: string): void {
			requirePluginCapability(pluginId, "editor:write")
			if (!editorViewRef) return
			const { from } = editorViewRef.state.selection.main
			editorViewRef.dispatch({
				changes: { from, insert: text },
			})
		},

		replaceSelection(text: string): void {
			requirePluginCapability(pluginId, "editor:write")
			if (!editorViewRef) return
			const { from, to } = editorViewRef.state.selection.main
			editorViewRef.dispatch({
				changes: { from, to, insert: text },
			})
		},
	}
}
