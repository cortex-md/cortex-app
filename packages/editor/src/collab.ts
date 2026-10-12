import type { Facet } from "@codemirror/state"
import type { Awareness } from "y-protocols/awareness"
import type * as Y from "yjs"
import { getEditorCollabCompartments, isCollabCompartmentBound } from "./extensions"
import { loadEditorRuntime } from "./runtime"
import type {
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeTransaction,
	EditorRuntimeView,
} from "./types"

export interface CollabEditorBinding {
	text: Y.Text
	awareness: Awareness
	undoManager: Y.UndoManager
}

type CollabSyncPredicate = (transaction: EditorRuntimeTransaction) => boolean
type CollabHistoryDirection = "undo" | "redo"
type CollabEditorRuntime = typeof import("y-codemirror.next")

interface CollabFacets {
	sync: Facet<CollabSyncPredicate, readonly CollabSyncPredicate[]>
	undoManager: Facet<Y.UndoManager, Y.UndoManager | null>
}

let collabEditorRuntimePromise: Promise<CollabEditorRuntime> | null = null
let collabFacets: CollabFacets | null = null
let vimHistoryPatched = false

function loadCollabEditorRuntime(): Promise<CollabEditorRuntime> {
	collabEditorRuntimePromise ??= import("y-codemirror.next")
	return collabEditorRuntimePromise
}

function getCollabFacets(runtime: EditorRuntimeModules): CollabFacets {
	collabFacets ??= {
		sync: runtime.state.Facet.define<CollabSyncPredicate>(),
		undoManager: runtime.state.Facet.define<Y.UndoManager, Y.UndoManager | null>({
			combine: (values) => values.at(-1) ?? null,
		}),
	}
	return collabFacets
}

export function isCollabSyncTransaction(
	runtime: EditorRuntimeModules,
	transaction: EditorRuntimeTransaction,
): boolean {
	return transaction.startState
		.facet(getCollabFacets(runtime).sync)
		.some((isSyncTransaction) => isSyncTransaction(transaction))
}

export function isExternalEditorTransaction(
	runtime: EditorRuntimeModules,
	transaction: EditorRuntimeTransaction,
): boolean {
	return (
		transaction.annotation(runtime.state.Transaction.remote) === true ||
		isCollabSyncTransaction(runtime, transaction)
	)
}

export function readOnlyDocumentExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return [
		runtime.state.EditorState.readOnly.of(true),
		runtime.state.EditorState.transactionFilter.of((transaction) =>
			transaction.docChanged && !isExternalEditorTransaction(runtime, transaction)
				? []
				: transaction,
		),
	]
}

function runCollabHistory(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	direction: CollabHistoryDirection,
): boolean {
	const undoManager = view.state.facet(getCollabFacets(runtime).undoManager)
	if (!undoManager) return false
	if (direction === "undo") undoManager.undo()
	else undoManager.redo()
	return true
}

function patchVimHistory(runtime: EditorRuntimeModules): void {
	if (vimHistoryPatched) return
	vimHistoryPatched = true
	const commands = runtime.vim.CodeMirror.commands
	const undo = commands.undo
	const redo = commands.redo
	commands.undo = (cm) => {
		if (!runCollabHistory(runtime, cm.cm6, "undo")) undo(cm)
	}
	commands.redo = (cm) => {
		if (!runCollabHistory(runtime, cm.cm6, "redo")) redo(cm)
	}
}

function collabExtension(
	runtime: EditorRuntimeModules,
	collabRuntime: CollabEditorRuntime,
	binding: CollabEditorBinding,
): EditorRuntimeExtension {
	const facets = getCollabFacets(runtime)
	const { ySyncAnnotation } = collabRuntime
	return runtime.state.Prec.high([
		collabRuntime.yCollab(binding.text, binding.awareness, { undoManager: binding.undoManager }),
		runtime.view.keymap.of(collabRuntime.yUndoManagerKeymap),
		facets.sync.of((transaction) => transaction.annotation(ySyncAnnotation) !== undefined),
		facets.undoManager.of(binding.undoManager),
	])
}

export async function attachCollabBinding(
	view: EditorRuntimeView,
	binding: CollabEditorBinding | null,
	isCurrent: () => boolean = () => true,
): Promise<void> {
	const runtime = await loadEditorRuntime()
	const compartments = getEditorCollabCompartments(runtime)
	if (!binding) {
		if (!isCurrent() || !isCollabCompartmentBound(runtime, view.state)) return
		view.dispatch({
			effects: [
				compartments.collab.reconfigure([]),
				compartments.history.reconfigure(runtime.commands.history()),
			],
		})
		return
	}
	const collabRuntime = await loadCollabEditorRuntime()
	if (!isCurrent()) return
	patchVimHistory(runtime)
	const content = binding.text.toString()
	const currentLength = view.state.doc.length
	view.dispatch({
		changes:
			view.state.doc.toString() === content
				? undefined
				: { from: 0, to: currentLength, insert: content },
		annotations: [
			runtime.state.Transaction.remote.of(true),
			runtime.state.Transaction.addToHistory.of(false),
		],
		effects: [
			compartments.history.reconfigure([]),
			compartments.collab.reconfigure(collabExtension(runtime, collabRuntime, binding)),
		],
	})
}
