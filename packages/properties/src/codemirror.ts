import type * as CodeMirrorStateModule from "@codemirror/state"
import type {
	EditorState as CodeMirrorEditorState,
	Extension,
	StateEffectType,
	StateField,
	Transaction,
} from "@codemirror/state"
import type * as CodeMirrorViewModule from "@codemirror/view"
import type { EditorView as CodeMirrorEditorView, ViewUpdate } from "@codemirror/view"
import type { FrontmatterEditorState, FrontmatterExtensionOptions, PropertyMap } from "./types"

interface FrontmatterCodeMirrorRuntime {
	state: typeof CodeMirrorStateModule
	view: typeof CodeMirrorViewModule
}

interface FrontmatterRuntimeState {
	frontmatterStateField: StateField<FrontmatterEditorState>
	setFrontmatterStateEffect: StateEffectType<FrontmatterEditorState>
	transaction: typeof CodeMirrorStateModule.Transaction
	viewPlugin: typeof CodeMirrorViewModule.ViewPlugin
}

type FrontmatterEditorView = Pick<CodeMirrorEditorView, "dispatch" | "state">

const emptyFrontmatterState: FrontmatterEditorState = {
	meta: {},
	error: null,
}

let runtimeState: FrontmatterRuntimeState | null = null
let runtimePromise: Promise<FrontmatterRuntimeState> | null = null

function createInitialState(options: FrontmatterExtensionOptions): FrontmatterEditorState {
	return {
		meta: options.initialMeta ?? {},
		error: options.initialError ?? null,
	}
}

function publishState(state: FrontmatterEditorState, options: FrontmatterExtensionOptions): void {
	if (state.error) {
		options.onError?.(new Error(state.error))
		return
	}
	options.onChange?.(state.meta)
}

function createRuntimeState(runtime: FrontmatterCodeMirrorRuntime): FrontmatterRuntimeState {
	if (runtimeState) return runtimeState

	const setFrontmatterStateEffect = runtime.state.StateEffect.define<FrontmatterEditorState>()
	const frontmatterStateField = runtime.state.StateField.define<FrontmatterEditorState>({
		create() {
			return emptyFrontmatterState
		},
		update(value: FrontmatterEditorState, transaction: Transaction) {
			for (const effect of transaction.effects) {
				if (effect.is(setFrontmatterStateEffect)) return effect.value
			}
			return value
		},
	})

	runtimeState = {
		frontmatterStateField,
		setFrontmatterStateEffect,
		transaction: runtime.state.Transaction,
		viewPlugin: runtime.view.ViewPlugin,
	}
	return runtimeState
}

async function loadFrontmatterRuntimeState(): Promise<FrontmatterRuntimeState> {
	if (runtimeState) return runtimeState
	runtimePromise ??= Promise.all([import("@codemirror/state"), import("@codemirror/view")]).then(
		([state, view]) => createRuntimeState({ state, view }),
	)
	return runtimePromise
}

export function createFrontmatterExtension(
	options: FrontmatterExtensionOptions = {},
): (runtime: FrontmatterCodeMirrorRuntime) => Extension {
	return (runtime: FrontmatterCodeMirrorRuntime) => {
		const currentRuntimeState = createRuntimeState(runtime)
		const initializedField = currentRuntimeState.frontmatterStateField.init(() =>
			createInitialState(options),
		)
		return [
			initializedField,
			currentRuntimeState.viewPlugin.fromClass(
				class {
					private currentState: FrontmatterEditorState

					constructor(view: FrontmatterEditorView) {
						this.currentState = view.state.field(
							currentRuntimeState.frontmatterStateField,
						) as FrontmatterEditorState
						publishState(this.currentState, options)
					}

					update(update: ViewUpdate) {
						const nextState = update.state.field(
							currentRuntimeState.frontmatterStateField,
						) as FrontmatterEditorState
						if (nextState === this.currentState) return
						this.currentState = nextState
						publishState(nextState, options)
					}
				},
			),
		]
	}
}

export async function getFrontmatterEditorState(
	state: CodeMirrorEditorState,
): Promise<FrontmatterEditorState> {
	const currentRuntimeState = await loadFrontmatterRuntimeState()
	return state.field(currentRuntimeState.frontmatterStateField) as FrontmatterEditorState
}

export async function updateFrontmatterEditorState(
	view: FrontmatterEditorView,
	meta: PropertyMap,
	error: string | null = null,
): Promise<void> {
	const currentRuntimeState = await loadFrontmatterRuntimeState()
	view.dispatch({
		effects: currentRuntimeState.setFrontmatterStateEffect.of({ meta, error }),
		annotations: [
			currentRuntimeState.transaction.remote.of(true),
			currentRuntimeState.transaction.addToHistory.of(false),
		],
	})
}
