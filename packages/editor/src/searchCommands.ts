import { loadEditorRuntime } from "./runtime"
import type {
	EditorRuntimeDecorationSet,
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeStateEffectType,
	EditorRuntimeStateField,
	EditorRuntimeView,
} from "./types"

export async function openFindPanel(view: EditorRuntimeView): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	runtime.search.openSearchPanel(view)
	return true
}

export interface SearchHighlightState {
	index: number
	total: number
}

interface SearchHighlightValue {
	query: string
	index: number
	ranges: ReadonlyArray<{ from: number; to: number }>
	decorations: EditorRuntimeDecorationSet
}

interface SearchHighlightRuntime {
	setQuery: EditorRuntimeStateEffectType<{ query: string; index: number } | null>
	field: EditorRuntimeStateField<SearchHighlightValue>
}

const highlightRuntimes = new WeakMap<EditorRuntimeModules, SearchHighlightRuntime>()
const SEARCH_TERM_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g

function findMatchRanges(text: string, query: string): Array<{ from: number; to: number }> {
	const terms = query
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((term) => term.replace(SEARCH_TERM_SPECIAL_CHARACTERS, "\\$&"))
	if (terms.length === 0) return []
	const ranges: Array<{ from: number; to: number }> = []
	for (const match of text.matchAll(new RegExp(terms.join("|"), "giu"))) {
		if (match[0]) ranges.push({ from: match.index, to: match.index + match[0].length })
	}
	return ranges
}

function getHighlightRuntime(runtime: EditorRuntimeModules): SearchHighlightRuntime {
	const cached = highlightRuntimes.get(runtime)
	if (cached) return cached
	const { Decoration, EditorView } = runtime.view
	const matchMark = Decoration.mark({ class: "cm-searchMatch" })
	const currentMark = Decoration.mark({ class: "cm-searchMatch cm-searchMatch-selected" })
	const build = (doc: string, query: string, index: number): SearchHighlightValue => {
		const ranges = query ? findMatchRanges(doc, query) : []
		const current = ranges.length > 0 ? Math.min(Math.max(index, 0), ranges.length - 1) : 0
		return {
			query,
			index: current,
			ranges,
			decorations: Decoration.set(
				ranges.map((range, rangeIndex) =>
					(rangeIndex === current ? currentMark : matchMark).range(range.from, range.to),
				),
			),
		}
	}
	const setQuery = runtime.state.StateEffect.define<{ query: string; index: number } | null>()
	const field = runtime.state.StateField.define<SearchHighlightValue>({
		create: () => ({ query: "", index: 0, ranges: [], decorations: Decoration.none }),
		update(value, transaction) {
			let next = value
			for (const effect of transaction.effects) {
				if (effect.is(setQuery)) {
					next = effect.value
						? build(transaction.state.doc.toString(), effect.value.query, effect.value.index)
						: build("", "", 0)
				}
			}
			if (next === value && transaction.docChanged && value.query) {
				next = build(transaction.state.doc.toString(), value.query, value.index)
			}
			return next
		},
		provide: (stateField) => EditorView.decorations.from(stateField, (value) => value.decorations),
	})
	const highlightRuntime = { setQuery, field }
	highlightRuntimes.set(runtime, highlightRuntime)
	return highlightRuntime
}

export function searchHighlightExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return getHighlightRuntime(runtime).field
}

export async function setSearchHighlight(
	view: EditorRuntimeView,
	query: string | null,
	index = 0,
): Promise<SearchHighlightState> {
	const runtime = await loadEditorRuntime()
	const highlight = getHighlightRuntime(runtime)
	if (!view.state.field(highlight.field, false)) return { index: 0, total: 0 }
	view.dispatch({ effects: highlight.setQuery.of(query ? { query, index } : null) })
	const value = view.state.field(highlight.field)
	const current = value.ranges[value.index]
	if (current) {
		view.dispatch({
			effects: runtime.view.EditorView.scrollIntoView(current.from, { y: "center" }),
		})
	}
	return { index: value.index, total: value.ranges.length }
}

export async function stepSearchHighlight(
	view: EditorRuntimeView,
	direction: -1 | 1,
): Promise<SearchHighlightState> {
	const runtime = await loadEditorRuntime()
	const value = view.state.field(getHighlightRuntime(runtime).field, false)
	if (!value || value.ranges.length === 0) return { index: 0, total: 0 }
	const nextIndex = (value.index + direction + value.ranges.length) % value.ranges.length
	return setSearchHighlight(view, value.query, nextIndex)
}
